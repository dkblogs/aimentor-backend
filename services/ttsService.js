const axios = require('axios');

// ── Clean markdown so TTS doesn't read symbols aloud ─────────────────────────
function cleanText(text) {
  return text
    .replace(/```[\s\S]*?```/g, '')           // remove code blocks
    .replace(/`[^`]+`/g, '')                  // remove inline code
    .replace(/#{1,6}\s/g, '')                 // remove headings
    .replace(/\*\*([^*]+)\*\*/g, '$1')        // bold → plain
    .replace(/\*([^*]+)\*/g, '$1')            // italic → plain
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → text only
    .replace(/^[-*•]\s/gm, '')                // remove bullets
    .replace(/^\d+\.\s/gm, '')                // remove numbered lists
    .replace(/[→←↑↓➡️⬅️]/g, '')             // remove arrows/emoji arrows
    .replace(/\n{2,}/g, '. ')                 // paragraph break → natural pause
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Fish Speech (fish.audio) ──────────────────────────────────────────────────
// Produces the most natural, teacher-like voice quality.
// Docs: https://docs.fish.audio/reference/tts
async function fishSpeechTTS(text) {
  const apiKey  = process.env.FISH_AUDIO_API_KEY;
  // Default voice: "Calm Female Teacher" reference model on fish.audio
  // You can browse voices at fish.audio and replace this ID
  const modelId = process.env.FISH_AUDIO_VOICE_ID || '5f558a394b2c4bbeb3fbd8c2fe2c0f23';

  if (!apiKey) throw new Error('FISH_AUDIO_API_KEY not set');

  const clean = cleanText(text).slice(0, 3000);

  const response = await axios.post(
    'https://api.fish.audio/v1/tts',
    {
      text: clean,
      reference_id: modelId,
      format: 'mp3',
      mp3_bitrate: 128,
      normalize: true,
      // Teacher-like prosody: slightly slower, clear articulation
      latency: 'normal',
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
      timeout: 20000,
    }
  );

  return response.data;
}

// ── ElevenLabs (fallback) ─────────────────────────────────────────────────────
async function elevenLabsTTS(text) {
  const apiKey  = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';

  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set');

  const clean = cleanText(text).slice(0, 2500);

  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      text: clean,
      model_id: 'eleven_turbo_v2',
      voice_settings: {
        stability: 0.48,
        similarity_boost: 0.80,
        style: 0.30,
        use_speaker_boost: true,
      },
    },
    {
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      responseType: 'arraybuffer',
      timeout: 15000,
    }
  );

  return response.data;
}

// ── Primary TTS: Fish Speech → ElevenLabs → error ────────────────────────────
async function synthesise(text) {
  // Try Fish Speech first
  if (process.env.FISH_AUDIO_API_KEY) {
    try {
      return { audio: await fishSpeechTTS(text), provider: 'fish' };
    } catch (err) {
      console.warn('Fish Speech failed, falling back to ElevenLabs:', err.message);
    }
  }

  // Fall back to ElevenLabs
  if (process.env.ELEVENLABS_API_KEY) {
    try {
      return { audio: await elevenLabsTTS(text), provider: 'elevenlabs' };
    } catch (err) {
      console.warn('ElevenLabs failed:', err.message);
    }
  }

  throw new Error('No TTS provider configured');
}

module.exports = { synthesise, cleanText };
