const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { generateResponse, generateQuiz, teachLesson, analyzeStudentPerformance } = require('../services/aiService');
const memoryService = require('../services/memoryService');
const didService    = require('../services/didService');
const { synthesise } = require('../services/ttsService');

const QUIZ_KEYWORDS = ['quiz', 'test my knowledge', 'generate a quiz', 'knowledge check'];

function detectScene(message) {
  const msg = message.toLowerCase();
  if (/planet|solar|orbit|space|galaxy|star|moon|mars|jupiter|saturn|earth|sun|astronom|comet|nebula|universe|cosmos/i.test(msg))
    return 'solar_system';
  if (/atom|electron|proton|neutron|molecule|quantum|nucleus|chemical|element|bond|chemistry|periodic/i.test(msg))
    return 'atom';
  if (/wave|frequency|oscillat|pendulum|vibrat|sound|light|magnetic|physics|energy|force|motion|gravity|newton|velocity|acceleration/i.test(msg))
    return 'wave';
  if (/math|equation|graph|function|calculus|algebra|geometry|trigonometry|integral|derivative|matrix|vector|formula|number/i.test(msg))
    return 'math';
  if (/code|program|algorithm|loop|variable|debug|software|javascript|python|java|html|css|web|app|machine learning|neural|data structure/i.test(msg))
    return 'coding';
  return 'default';
}

// Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => { cb(null, Date.now() + path.extname(file.originalname)); }
});
const upload = multer({ storage });

// ── Chat ─────────────────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  try {
    const { message, userId, subject = 'General', difficulty = 'Intermediate', history = [], classLevel = 9, language = 'en' } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });
    if (!process.env.OPENROUTER_API_KEY) return res.status(503).json({ error: 'OPENROUTER_API_KEY not configured on server' });

    const isQuizRequest = QUIZ_KEYWORDS.some(kw => message.toLowerCase().includes(kw));

    let reply, quiz = null, followups = [];

    if (isQuizRequest) {
      const result = await generateQuiz(subject, difficulty, classLevel, language);
      reply = result.reply;
      quiz  = result.quiz;
    } else {
      const result = await generateResponse(message, subject, history, difficulty, language);
      reply     = result.reply;
      followups = result.followups;
    }

    memoryService.saveToHistory(userId || 'guest', message, reply).catch(() => {});

    const scene = detectScene(message);
    res.json({ reply, quiz, scene, followups });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat' });
  }
});

// ── Teach: structured lesson delivery ────────────────────────────────────────
router.post('/teach', async (req, res) => {
  try {
    const { subject = 'General', topic, difficulty = 'Intermediate', userId, chapter = null, classLevel = 9, language = 'en' } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is required' });

    const { lesson, followups } = await teachLesson(subject, topic, difficulty, chapter, classLevel, language);

    memoryService.saveToHistory(userId || 'guest', `Teach me about: ${topic}`, lesson).catch(() => {});

    const scene = detectScene(topic + ' ' + subject);
    res.json({ lesson, followups, scene });
  } catch (error) {
    console.error('Teach error:', error);
    res.status(500).json({ error: 'Failed to deliver lesson' });
  }
});

// ── Analyze: AI-powered student performance report ────────────────────────────
router.post('/analyze', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const [scores, history] = await Promise.all([
      memoryService.getQuizScores(userId),
      memoryService.getHistory(userId),
    ]);

    const analysis = await analyzeStudentPerformance(scores, history);
    res.json(analysis);
  } catch (error) {
    console.error('Analyze error:', error);
    res.status(500).json({ error: 'Failed to analyze performance' });
  }
});

// ── Quiz score ────────────────────────────────────────────────────────────────
router.post('/quiz-score', async (req, res) => {
  try {
    const { userId, subject, difficulty, correct, total } = req.body;
    if (correct === undefined || total === undefined) return res.status(400).json({ error: 'Score data required' });
    await memoryService.saveQuizScore(userId || 'guest', subject || 'General', difficulty || 'Intermediate', correct, total);
    res.json({ status: 'success' });
  } catch (error) {
    console.error('Save score error:', error);
    res.status(500).json({ error: 'Failed to save score' });
  }
});

router.get('/quiz-scores/:userId', async (req, res) => {
  try {
    const scores = await memoryService.getQuizScores(req.params.userId);
    res.json({ scores });
  } catch (error) {
    console.error('Get scores error:', error);
    res.status(500).json({ error: 'Failed to fetch scores' });
  }
});

// ── History ───────────────────────────────────────────────────────────────────
router.get('/history/:userId', async (req, res) => {
  try {
    const history = await memoryService.getHistory(req.params.userId);
    res.json({ history });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ── Profile ───────────────────────────────────────────────────────────────────
router.get('/profile/:userId', async (req, res) => {
  try {
    const profile = await memoryService.getProfile(req.params.userId);
    res.json({ profile });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.post('/profile/:userId', async (req, res) => {
  try {
    await memoryService.updateProfile(req.params.userId, req.body);
    res.json({ status: 'success' });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ── ElevenLabs TTS ────────────────────────────────────────────────────────────
router.post('/tts', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text required' });

  const hasAnyTTS = process.env.FISH_AUDIO_API_KEY || process.env.ELEVENLABS_API_KEY;
  if (!hasAnyTTS) return res.status(503).json({ error: 'No TTS provider configured' });

  try {
    const { audio, provider } = await synthesise(text);
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'no-store');
    res.set('X-TTS-Provider', provider);
    res.send(Buffer.from(audio));
  } catch (error) {
    console.error('TTS error:', error.message);
    res.status(500).json({ error: 'TTS failed' });
  }
});

// ── D-ID ─────────────────────────────────────────────────────────────────────
router.post('/generate-video', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });
    if (!process.env.DID_API_KEY) return res.status(503).json({ error: 'D-ID not configured' });
    const talkId = await didService.createTalk(text);
    res.json({ talkId });
  } catch (error) {
    console.error('D-ID generate error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to generate video' });
  }
});

router.get('/video-status/:talkId', async (req, res) => {
  try {
    if (!process.env.DID_API_KEY) return res.status(503).json({ error: 'D-ID not configured' });
    const result = await didService.getTalkStatus(req.params.talkId);
    res.json(result);
  } catch (error) {
    console.error('D-ID status error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to check video status' });
  }
});

module.exports = router;
