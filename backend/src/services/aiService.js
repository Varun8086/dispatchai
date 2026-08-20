const axios = require('axios');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';

async function askAssistant(question) {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/ask`, { question });
    return response.data;
  } catch (err) {
    console.error('AI service call failed:', err.message);
    return {
      answer: "I'm having trouble answering right now. Please contact support directly.",
      sources: [],
    };
  }
}

module.exports = { askAssistant };