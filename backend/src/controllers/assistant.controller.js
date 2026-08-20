const { askAssistant } = require('../services/aiService');

async function ask(req, res, next) {
  try {
    const { question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'question is required' });
    }

    const result = await askAssistant(question.trim());
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { ask };