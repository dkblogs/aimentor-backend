const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SUBJECT_PROMPTS = {
  // NCERT Class 9 subjects
  Mathematics:        "You are an expert Mathematics tutor for NCERT Class 9. Show clear step-by-step working, relate to NCERT examples, highlight theorems and formulae. Be concise.",
  Physics:            "You are an expert Physics tutor for NCERT Class 9. Explain using real-world examples, derive key formulae, refer to NCERT diagrams and experiments. Be concise.",
  Chemistry:          "You are an expert Chemistry tutor for NCERT Class 9. Explain reactions, atomic models, and separation techniques with clarity. Relate to NCERT lab activities. Be concise.",
  Biology:            "You are an expert Biology tutor for NCERT Class 9. Use vivid analogies, refer to NCERT diagrams of cells, tissues, and organisms. Be concise.",
  History:            "You are an expert History tutor for NCERT Class 9 (India and the Contemporary World). Give causes, events, and effects clearly; link to Indian and global context. Be concise.",
  Geography:          "You are an expert Geography tutor for NCERT Class 9 (Contemporary India). Explain physical and human geography with map references and Indian examples. Be concise.",
  "Political Science":"You are an expert Political Science tutor for NCERT Class 9 (Democratic Politics). Explain democratic institutions, rights, and processes using Indian constitutional examples. Be concise.",
  Economics:          "You are an expert Economics tutor for NCERT Class 9. Explain basic economic concepts through Indian village and national examples as in the NCERT textbook. Be concise.",
  // Fallback
  General:            "You are a helpful AI learning mentor for Class 9 students. Be concise, clear, and encouraging.",
};

const DIFFICULTY_NOTES = {
  Beginner:     "Use very simple language, avoid jargon, use analogies. Assume the student is new to the topic.",
  Intermediate: "Use moderate technical depth. Assume basic familiarity with the topic.",
  Advanced:     "Use technical language, go deep, include edge cases and nuances.",
};

const LANGUAGE_INSTRUCTION = `CRITICAL LANGUAGE RULE: Detect the language of the user's message and respond ENTIRELY in that same language. If the user writes in Hindi, respond in Hindi. If in Hinglish (Hindi+English mix), respond in Hinglish. If in Tamil, respond in Tamil. If in any regional language, respond in that language. Never switch languages unless the user does. Do NOT translate or summarise in another language.`;

// ── Chat with follow-ups ──────────────────────────────────────────────────────
async function generateResponse(message, subject = "General", history = [], difficulty = "Intermediate") {
  try {
    const subjectPrompt = SUBJECT_PROMPTS[subject] || SUBJECT_PROMPTS.General;
    const diffNote      = DIFFICULTY_NOTES[difficulty] || DIFFICULTY_NOTES.Intermediate;
    const systemPrompt  = `${subjectPrompt} ${diffNote} ${LANGUAGE_INSTRUCTION} After your answer, add exactly this line: "FOLLOWUPS: question1 | question2 | question3" with 3 short follow-up questions the student might ask next (write them in the same language as your response).`;

    const historyMessages = history.slice(-5).flatMap(h => [
      { role: "user",      content: h.message  },
      { role: "assistant", content: h.response },
    ]);

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user",   content: message },
      ],
      temperature: 0.7,
      max_tokens: 1200,
    });

    const full = completion.choices[0]?.message?.content || "";
    const followupMatch = full.match(/FOLLOWUPS:\s*(.+)$/m);
    const followups = followupMatch
      ? followupMatch[1].split("|").map(s => s.trim()).filter(Boolean).slice(0, 3)
      : [];
    const reply = full.replace(/FOLLOWUPS:.*$/m, "").trim();

    return { reply, followups };
  } catch (error) {
    console.error("Groq ERROR:", error.message);
    return { reply: "AI is temporarily unavailable. Please try again.", followups: [] };
  }
}

// ── Structured lesson delivery ────────────────────────────────────────────────
async function teachLesson(subject = "General", topic, difficulty = "Intermediate", chapter = null, classLevel = 9, language = "en") {
  try {
    const diffNote   = DIFFICULTY_NOTES[difficulty] || DIFFICULTY_NOTES.Intermediate;
    const ncertCtx   = chapter
      ? `This is Chapter ${chapter} of the NCERT Class ${classLevel} ${subject} textbook.`
      : `This is from the NCERT Class ${classLevel} ${subject} syllabus.`;

    const langNote   = language && language !== "en"
      ? `IMPORTANT: Deliver this entire lesson in the student's preferred language (detected: "${language}"). Use their language for all explanations, examples, and key terms — you may keep technical/scientific terms in English where appropriate.`
      : LANGUAGE_INSTRUCTION;

    const prompt = `You are an expert ${subject} teacher for NCERT Class ${classLevel} students. Deliver a clear, engaging structured lesson.

Topic: "${topic}"
${ncertCtx}
${diffNote}
${langNote}

Write the lesson using this exact structure with markdown:

## 📖 Introduction
[2-3 sentences: what is this topic, why it matters, and how it fits in the NCERT Class ${classLevel} syllabus]

## 🔑 Key Concepts

**1. [Concept Name]**
[Clear explanation, 2-3 sentences. Use an analogy if helpful. Reference NCERT examples where relevant.]

**2. [Concept Name]**
[Clear explanation, 2-3 sentences.]

**3. [Concept Name]**
[Clear explanation, 2-3 sentences.]

## 💡 Real-World Example
[One vivid, concrete example that makes the topic click — relate to India or everyday life where possible.]

## ✅ What You Learned
- [Key takeaway 1]
- [Key takeaway 2]
- [Key takeaway 3]

After the lesson content add exactly: "FOLLOWUPS: question1 | question2 | question3"`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: `You are an expert ${subject} teacher for NCERT Class ${classLevel}. Deliver structured, engaging lessons using markdown. Stay aligned with NCERT content. ${langNote}` },
        { role: "user",   content: prompt },
      ],
      temperature: 0.65,
      max_tokens: 1500,
    });

    const full = completion.choices[0]?.message?.content || "";
    const followupMatch = full.match(/FOLLOWUPS:\s*(.+)$/m);
    const followups = followupMatch
      ? followupMatch[1].split("|").map(s => s.trim()).filter(Boolean).slice(0, 3)
      : [];
    const lesson = full.replace(/FOLLOWUPS:.*$/m, "").trim();

    return { lesson, followups };
  } catch (error) {
    console.error("Teach ERROR:", error.message);
    return { lesson: "Could not load lesson. Please try again.", followups: [] };
  }
}

// ── Quiz generation ───────────────────────────────────────────────────────────
async function generateQuiz(subject = "General", difficulty = "Intermediate", classLevel = 9, language = "en") {
  try {
    const diffNote = DIFFICULTY_NOTES[difficulty] || DIFFICULTY_NOTES.Intermediate;
    const langNote = language && language !== "en"
      ? `Write all questions and options in the student's language (detected: "${language}"). You may keep scientific/technical terms in English.`
      : ``;
    const prompt = `Generate a 5-question multiple choice quiz on NCERT Class ${classLevel} ${subject} at ${difficulty} level. ${diffNote} ${langNote}
Questions must be strictly based on the NCERT Class ${classLevel} ${subject} textbook syllabus.
Return ONLY valid JSON, no markdown:
{
  "intro": "Here is your Class ${classLevel} ${subject} quiz!",
  "questions": [
    { "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "A) ..." }
  ]
}`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are a quiz generator. Return only valid JSON, no extra text." },
        { role: "user",   content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 1200,
    });

    const rawText  = completion.choices[0]?.message?.content?.trim() || "";
    const jsonText = rawText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed   = JSON.parse(jsonText);

    return {
      reply: parsed.intro || `Here's your ${subject} quiz!`,
      quiz:  { questions: parsed.questions },
    };
  } catch (error) {
    console.error("Quiz ERROR:", error.message);
    return { reply: "I couldn't generate a quiz right now. Please try again.", quiz: null };
  }
}

// ── AI-powered student performance analysis ───────────────────────────────────
async function analyzeStudentPerformance(scores, history) {
  try {
    if (!scores || scores.length === 0) {
      return {
        analysis: "You haven't taken any quizzes yet! Start with a topic you're curious about, take a quiz, and I'll build you a detailed performance report.",
        strengths: [],
        weaknesses: [],
        actionItems: [
          "Take your first quiz on any subject",
          "Study a topic using the Learning Path",
          "Come back here for personalized insights"
        ],
        overallGrade: "—",
        avgScore: 0,
      };
    }

    // Aggregate per-subject
    const bySubject = scores.reduce((acc, s) => {
      if (!acc[s.subject]) acc[s.subject] = { correct: 0, total: 0, count: 0 };
      acc[s.subject].correct += s.score;
      acc[s.subject].total   += s.total;
      acc[s.subject].count   += 1;
      return acc;
    }, {});

    const scoreSummary = Object.entries(bySubject).map(([subj, d]) => {
      const pct = Math.round((d.correct / d.total) * 100);
      return `${subj}: ${pct}% (${d.count} quiz${d.count > 1 ? 'zes' : ''})`;
    }).join(", ");

    const avgScore = Math.round(
      scores.reduce((acc, s) => acc + (s.score / s.total) * 100, 0) / scores.length
    );

    const recentTopics = history.slice(-8).map(h => h.message?.substring(0, 60)).filter(Boolean).join("; ");

    const prompt = `Analyze this student's performance data and write a personalized academic assessment.

Quiz Performance: ${scoreSummary}
Total quizzes taken: ${scores.length}
Overall average: ${avgScore}%
Recent topics they studied: ${recentTopics || "Not available"}

Provide a concise but insightful analysis. Return ONLY valid JSON:
{
  "analysis": "2-3 sentences of personalized, encouraging analysis that names specific subjects and patterns",
  "strengths": ["Subject: specific strength noted", "Subject: specific strength noted"],
  "weaknesses": ["Subject: specific gap or pattern", "Subject: specific gap or pattern"],
  "actionItems": ["Specific, actionable recommendation 1", "Specific recommendation 2", "Specific recommendation 3"]
}`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are a data-driven academic mentor. Write specific, encouraging, actionable feedback. Return only valid JSON." },
        { role: "user",   content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 500,
    });

    const raw   = completion.choices[0]?.message?.content?.trim() || "{}";
    const clean = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(clean);

    const grade = avgScore >= 90 ? "A" : avgScore >= 80 ? "B" : avgScore >= 70 ? "C" : avgScore >= 60 ? "D" : "F";

    return { ...parsed, overallGrade: grade, avgScore };
  } catch (error) {
    console.error("Analyze ERROR:", error.message);
    return {
      analysis: "Analysis temporarily unavailable. Please try again.",
      strengths: [], weaknesses: [], actionItems: [],
      overallGrade: "—", avgScore: 0,
    };
  }
}

module.exports = { generateResponse, generateQuiz, teachLesson, analyzeStudentPerformance };
