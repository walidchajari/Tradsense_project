require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 8002;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-pro';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 12000);
const GEMINI_BASE_URL = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MAX_RETRIES = Number(process.env.GEMINI_MAX_RETRIES || 2);
const GEMINI_RETRY_BASE_MS = Number(process.env.GEMINI_RETRY_BASE_MS || 1000);

const normalizeModelName = (name) => {
  if (!name) return 'gemini-pro-latest';
  return name.replace(/^models\//, '');
};

const listModels = async () => {
  if (!GEMINI_API_KEY) {
    return ['gemini-pro'];
  }
  try {
    const url = `${GEMINI_BASE_URL}/models?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const response = await axios.get(url, { timeout: GEMINI_TIMEOUT_MS });
    const models = response.data?.models || [];
    const names = models.map((m) => m.name).filter(Boolean);
    return names.length ? names : ['gemini-pro'];
  } catch (err) {
    console.error('List models error:', err?.response?.data || err?.message || err);
    return ['gemini-pro'];
  }
};

const extractReply = (data) => {
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text === 'string' && text.trim()) return text.trim();
  return null;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.get('/api/chat/gemini/models', async (req, res) => {
  try {
    const models = await listModels();
    return res.status(200).json({ models });
  } catch (err) {
    console.error('List models error:', err);
    return res.status(500).json({ error: 'Failed to list models' });
  }
});

app.post('/api/chat/gemini', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is not configured' });
    }

    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'Missing message' });
    }

    const payload = {
      contents: [
        {
          parts: [{ text: message }],
        },
      ],
    };

    const modelCandidates = [
      normalizeModelName(GEMINI_MODEL),
      'gemini-pro-latest',
      'gemini-flash-latest',
    ];
    let response = null;
    let lastError = null;
    for (const modelName of modelCandidates) {
      const modelId = normalizeModelName(modelName);
      const url = `${GEMINI_BASE_URL}/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
      for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt += 1) {
        try {
          response = await axios.post(url, payload, {
            timeout: GEMINI_TIMEOUT_MS,
            headers: { 'Content-Type': 'application/json' },
          });
          break;
        } catch (err) {
          lastError = err;
          const status = err?.response?.status;
          const message = err?.response?.data?.error?.message || '';
          if (message.includes('NOT_FOUND')) {
            response = null;
            break;
          }
          if (status === 429 && attempt < GEMINI_MAX_RETRIES) {
            const retryDelay = err?.response?.data?.error?.details?.find((d) => d?.retryDelay)?.retryDelay;
            const retryMs = retryDelay
              ? Math.max(500, Math.min(10000, Number(String(retryDelay).replace('s', '')) * 1000))
              : GEMINI_RETRY_BASE_MS * (attempt + 1);
            await sleep(retryMs);
            continue;
          }
          throw err;
        }
      }
      if (response) break;
    }
    if (!response && lastError) {
      throw lastError;
    }

    const reply = extractReply(response.data);
    if (!reply) {
      return res.status(500).json({ error: 'Gemini response missing text' });
    }

    return res.status(200).json({ reply });
  } catch (err) {
    const status = err?.response?.status || 500;
    const details = err?.response?.data || err?.message || 'Gemini request failed';
    console.error('Gemini error:', details);
    if (status === 429) {
      return res.status(429).json({
        error: 'Gemini rate limit exceeded',
        details,
      });
    }
    return res.status(status === 401 || status === 403 ? 502 : 500).json({ error: 'Gemini request failed', details });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Gemini backend running on port ${PORT}`);
});
