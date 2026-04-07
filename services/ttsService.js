const axios = require('axios');

// Clean markdown before sending to TTS
function cleanText(text) {
  return text
    .replace(/```[\s\S]*?```/g, '')          // remove code blocks
    .replace(/`[^`]+`/g, '')                 // remove inline code
    .replace(/#{1,6}\s/g, '')                // remove headings
    .replace(/\*\*([^*]+)\*\*/g, '$1')       // bold → plain
    .replace(/\*([^*]+)\*/g, '$1')           // italic → plain
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → text
    .replace(/^[-*•]\s/gm, '')               // remove bullets
    .replace(/^\d+\.\s/gm, '')               // remove numbered lists
    .replace(/[→←↑↓→]/g, '')                // remove arrows
    .replace(/\n{2,}/g, '. ')               // paragraph break → pause
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function elevenLabsTTS(text) {
  const apiKey  = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';

  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set');

  const clean = cleanText(text).slice(0, 2500); // ElevenLabs character limit

  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      text: clean,
      model_id: 'eleven_turbo_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.78,
        style: 0.25,
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

module.exports = { elevenLabsTTS, cleanText };
