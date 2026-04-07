const axios = require('axios');

const DID_BASE = 'https://api.d-id.com';

function getAuthHeader() {
  const token = Buffer.from(`${process.env.DID_API_KEY}:`).toString('base64');
  return `Basic ${token}`;
}

// Clean text for D-ID — strip markdown, truncate to keep video short
function cleanText(text) {
  return text
    .replace(/[*_#`>\[\]]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 350);
}

async function createTalk(text) {
  const script = cleanText(text);

  const response = await axios.post(
    `${DID_BASE}/talks`,
    {
      source_url: process.env.DID_PRESENTER_IMAGE_URL,
      script: {
        type: 'text',
        input: script,
        provider: {
          type: 'microsoft',
          voice_id: process.env.DID_VOICE_ID || 'en-US-GuyNeural',
        },
      },
      config: { fluent: true, pad_audio: 0.0 },
    },
    {
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  );

  return response.data.id;
}

async function getTalkStatus(talkId) {
  const response = await axios.get(`${DID_BASE}/talks/${talkId}`, {
    headers: {
      Authorization: getAuthHeader(),
      Accept: 'application/json',
    },
  });

  const { status, result_url } = response.data;
  return { status, videoUrl: result_url || null };
}

module.exports = { createTalk, getTalkStatus };
