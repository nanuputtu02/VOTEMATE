const express = require("express");
const router = express.Router();
const Election = require("../models/Election");
const Vote = require("../models/Vote");
const Candidate = require("../models/Candidate");
const { authenticate } = require("../middleware/authMiddleware");

// ✅ Get the currently active election with candidates
router.get("/active-election", authenticate, async (req, res) => {
  try {
    const now = new Date();

    // ✅ Find any election that is active and within duration
    const activeElection = await Election.findOne({
      isActive: true,
      startTime: { $lte: now },
      $expr: {
        $lt: [
          { $subtract: [now, "$startTime"] },
          { $multiply: ["$duration", 60000] },
        ],
      },
    }).populate("candidates");

    // If not found, return message
    if (!activeElection) {
      return res.json({ isActive: false, message: "No active election right now" });
    }

    res.json({
      _id: activeElection._id,
      title: activeElection.title,
      description: activeElection.description,
      duration: activeElection.duration,
      startTime: activeElection.startTime,
      isActive: true,
      candidates: activeElection.candidates,
    });
  } catch (error) {
    console.error("Error fetching active election:", error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ Submit a vote (each student only once per gender per election)
router.post("/vote", authenticate, async (req, res) => {
  try {
    const { electionId, candidateId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized - Invalid token" });
    }

    if (!electionId || !candidateId) {
      return res.status(400).json({ message: "Election ID and candidate ID are required" });
    }

    const election = await Election.findById(electionId);
    if (!election) return res.status(404).json({ message: "Election not found" });

    const now = Date.now();
    const endTime = election.startTime.getTime() + election.duration * 60 * 1000;
    if (now > endTime || election.isActive === false) {
      return res.status(403).json({ message: "Election has ended" });
    }

    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      return res.status(400).json({ message: "Invalid candidate for this election" });
    }

    const gender = candidate.gender;

    const existingVote = await Vote.findOne({ user: userId, election: electionId, gender });
    if (existingVote) {
      return res.status(400).json({ message: `You have already voted for a ${gender} CR` });
    }

    const vote = new Vote({ user: userId, election: electionId, candidate: candidateId, gender });
    await vote.save();

    res.status(201).json({ message: "Vote submitted successfully ✅" });
  } catch (error) {
    console.error("Error submitting vote:", error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ Live Results for Student Dashboard
router.get("/results/:electionId", authenticate, async (req, res) => {
  try {
    const { electionId } = req.params;
    const election = await Election.findById(electionId);
    if (!election) return res.status(404).json({ message: "Election not found" });

    const candidates = await Candidate.find({ election: electionId });
    const maleCandidates = candidates.filter(c => c.gender === "Male");
    const femaleCandidates = candidates.filter(c => c.gender === "Female");

    const maleResults = await Promise.all(
      maleCandidates.map(async (c) => ({
        name: c.name,
        votes: await Vote.countDocuments({ candidate: c._id }),
      }))
    );
    const femaleResults = await Promise.all(
      femaleCandidates.map(async (c) => ({
        name: c.name,
        votes: await Vote.countDocuments({ candidate: c._id }),
      }))
    );

    const maleWinner = maleResults.reduce((a, b) => (a.votes > b.votes ? a : b), { name: "None", votes: 0 });
    const femaleWinner = femaleResults.reduce((a, b) => (a.votes > b.votes ? a : b), { name: "None", votes: 0 });

    res.json({
      election: election.title,
      maleCandidates: maleResults,
      femaleCandidates: femaleResults,
      maleWinner,
      femaleWinner,
      isActive: election.isActive,
    });
  } catch (error) {
    console.error("Error fetching results:", error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ Fetch past CR winners (for right panel)
router.get("/past-winners", authenticate, async (req, res) => {
  try {
    const completedElections = await Election.find({ isActive: false })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("candidates");

    if (!completedElections.length) {
      return res.json([]);
    }

    const results = [];
    for (const election of completedElections) {
      const male = election.candidates.filter(c => c.gender === "Male");
      const female = election.candidates.filter(c => c.gender === "Female");

      const maleVotes = await Promise.all(male.map(async (c) => ({
        name: c.name,
        votes: await Vote.countDocuments({ candidate: c._id }),
      })));

      const femaleVotes = await Promise.all(female.map(async (c) => ({
        name: c.name,
        votes: await Vote.countDocuments({ candidate: c._id }),
      })));

      const maleWinner = maleVotes.reduce((a, b) => (a.votes > b.votes ? a : b), { name: "No male candidate", votes: 0 });
      const femaleWinner = femaleVotes.reduce((a, b) => (a.votes > b.votes ? a : b), { name: "No female candidate", votes: 0 });

      results.push({
        election: election.title,
        maleWinner: maleWinner.name,
        femaleWinner: femaleWinner.name,
      });
    }

    res.json(results);
  } catch (error) {
    console.error("Error fetching past winners:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
