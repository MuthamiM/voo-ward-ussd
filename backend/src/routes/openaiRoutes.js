// backend/src/routes/openaiRoutes.js
const express = require('express');
const router = express.Router();

// Use the official OpenAI SDK
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/openai/ask
 * Body: { prompt: string }
 * Returns: { result: string }
 */
router.post('/ask', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 256
    });
    res.json({ result: completion.choices[0].message.content });
  } catch (err) {
    console.error('[OPENAI] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
