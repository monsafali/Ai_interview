// server/routes/interviewRoutes.js
const express = require("express");
const router = express.Router();


// Models
const InterviewAttempt = require("../models/InterviewAttempt");

// Controllers
const interviewController = require("../controllers/interviewController");
const {
  submitInterview,
  evaluateAttempt,
  getAttempt,
  getMyAttempts,
  getMyAttempt,
  getTopScorers
  // startAttempt may or may not exist in your controller; we will access via interviewController.startAttempt safely
} = interviewController;

// Auth middlewares
const { protect, adminOnly } = require("../middleware/auth");
const { callOpenAIChat } = require("../utils/openai");

/**
 * ------------------------------------
 * 1) Question Generation with Ollama
 *    POST /api/interview/generate
 * ------------------------------------
 */

router.post("/generate", async (req, res) => {
  const { jobTitle, difficulty, numberOfQuestions } = req.body;
  
  if (!jobTitle || !numberOfQuestions) {
    return res.status(400).json({ error: "jobTitle and numberOfQuestions are required" });
  }

  const systemPrompt = "You are an expert technical recruiter.";
  const userPrompt = `
    Generate EXACTLY ${numberOfQuestions} interview questions for a ${jobTitle}.
    Difficulty: ${difficulty}
    
    Rules:
    - Return EXACTLY ${numberOfQuestions} items.
    - Allowed types: "text" or "mcq" only.
    - For "mcq", include 4 options.
    
    Return ONLY valid JSON in this format:
    [
      { "type": "text" | "mcq", "question": "string", "options": ["opt1", "opt2", "opt3", "opt4"], "answer": "" }
    ]
  `;

  try {
    // ✅ Call OpenAI instead of the local Ollama fetch
    const rawResponse = await callOpenAIChat({
      model: "gpt-4o-mini", // Or your preferred model
      systemPrompt,
      userPrompt,
    });

    // Clean any markdown backticks if OpenAI includes them
    const jsonString = rawResponse.replace(/```json|```/g, "").trim();
    let questions = JSON.parse(jsonString);

    // Normalize fields
    questions = (Array.isArray(questions) ? questions : []).map((q) => ({
      type: q.type || "text",
      question: q.question || q.questionText || "",
      options: Array.isArray(q.options) ? q.options : [],
      answer: q.answer || "",
    }));

    return res.json({ questions });

  } catch (err) {
    console.error("Generate route error:", err);
    return res.status(500).json({ error: "Failed to generate questions", details: err.message });
  }
});

/**
 * ------------------------------------
 * 2) Candidate starts attempt (optional)
 *    POST /api/interview/start
 * ------------------------------------
 * Only enable if you actually implemented startAttempt in controller.
 */
if (typeof interviewController.startAttempt === "function") {
  router.post("/start", protect, interviewController.startAttempt);
}

/**
 * ------------------------------------
 * 3) Candidate submits interview
 *    POST /api/interview/submit
 * ------------------------------------
 */
router.post("/submit", protect, submitInterview);

/**
 * ------------------------------------
 * 4) Candidate views their own attempts
 *    GET /api/interview/my-attempts
 * ------------------------------------
 */
router.get("/my-attempts", protect, getMyAttempts);
router.get("/my-attempt/:id", protect, getMyAttempt);
// ✅ Admin leaderboard
router.get("/top-scorers", protect, adminOnly, getTopScorers);


/**
 * ------------------------------------
 * 5) Admin: list all attempts
 *    GET /api/interview/attempts
 * ------------------------------------
 */
router.get("/attempts", protect, adminOnly, async (req, res) => {
  try {
    const attempts = await InterviewAttempt.find()
      .populate({ path: "job", select: "title createdBy" })
      .populate("candidate", "name email")
      .sort({ createdAt: -1 });

    const filtered = attempts.filter(
      (a) => String(a.job?.createdBy) === String(req.user.id)
    );

    res.json({ attempts: filtered });
  } catch (err) {
    console.error("list attempts error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


/**
 * ------------------------------------
 * 6) Admin views a specific attempt
 *    GET /api/interview/attempt/:id
 * ------------------------------------
 */
router.get("/attempt/:id", protect, adminOnly, getAttempt);

/**
 * ------------------------------------
 * 7) Admin evaluates an attempt (AI)
 *    POST /api/interview/evaluate/:attemptId
 * ------------------------------------
 */
router.post("/evaluate/:attemptId", protect, adminOnly, evaluateAttempt);

module.exports = router;
