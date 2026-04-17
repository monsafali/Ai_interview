// server/utils/openai.js
require("dotenv").config();
const { OpenAI } = require("openai");

// Initialize the client with your API Key from .env
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Helper to call OpenAI using the Chat Completions endpoint.
 * Uses the official 'messages' array format for better context handling.
 */
async function callOpenAIChat({ model = "gpt-4o", systemPrompt = "", userPrompt = "" }) {
  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      // Adjust temperature based on how creative you want the AI to be (0 to 2)
      temperature: 0.7, 
    });

    // OpenAI returns the text in the first choice's message content
    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw new Error(`OpenAI error: ${error.message}`);
  }
}

module.exports = { callOpenAIChat };