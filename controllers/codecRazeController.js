const CodecRazeProblem = require('../models/CodecRazeProblem');
const axios = require('axios');

// Create a new coding problem
exports.createProblem = async (req, res) => {
  try {
    const problem = new CodecRazeProblem(req.body);
    await problem.save();
    res.status(201).json(problem);
  } catch (error) {
    res.status(400).json({ message: 'Error creating problem', error: error.message });
  }
};

// Get all coding problems
exports.getProblems = async (req, res) => {
  try {
    const problems = await CodecRazeProblem.find();
    res.json(problems);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching problems', error: error.message });
  }
};

// Get a single problem by ID
exports.getProblemById = async (req, res) => {
  try {
    const problem = await CodecRazeProblem.findById(req.params.id);
    if (!problem) return res.status(404).json({ message: 'Problem not found' });
    res.json(problem);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching problem', error: error.message });
  }
};

// Judge0 API config
const JUDGE0_API_URL = 'https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true';
const JUDGE0_HEADERS = {
  'Content-Type': 'application/json',
  'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
  // 'X-RapidAPI-Key': process.env.JUDGE0_API_KEY, // Optional: add your key here
};

// Submit solution for a problem
exports.submitSolution = async (req, res) => {
  try {
    const { code, language } = req.body;
    const problemId = req.params.problemId;
    if (!code || !language) {
      return res.status(400).json({ message: 'Code and language are required.' });
    }
    const problem = await require('../models/CodecRazeProblem').findById(problemId);
    if (!problem) return res.status(404).json({ message: 'Problem not found' });
    // Map language to Judge0 language_id
    const langMap = { python: 71, cpp: 54, javascript: 63, java: 62 };
    const language_id = langMap[language];
    if (!language_id) return res.status(400).json({ message: 'Unsupported language' });
    // Run code against all non-sample test cases
    const testCases = problem.testCases.filter(tc => !tc.isSample);
    const results = [];
    for (const tc of testCases) {
      const submission = {
        source_code: code,
        language_id,
        stdin: tc.input,
        expected_output: tc.output
      };
      try {
        const judgeRes = await axios.post(JUDGE0_API_URL, submission, { headers: JUDGE0_HEADERS });
        results.push({
          input: tc.input,
          expected: tc.output,
          stdout: judgeRes.data.stdout,
          stderr: judgeRes.data.stderr,
          status: judgeRes.data.status,
          time: judgeRes.data.time,
          memory: judgeRes.data.memory,
          passed: judgeRes.data.status && judgeRes.data.status.id === 3 // 3 = Accepted
        });
      } catch (err) {
        results.push({
          input: tc.input,
          expected: tc.output,
          error: err.message,
          passed: false
        });
      }
    }
    res.json({ results });
  } catch (error) {
    res.status(500).json({ message: 'Error submitting solution', error: error.message });
  }
}; 