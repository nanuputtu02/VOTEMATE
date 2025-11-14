const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Election = require("../models/Election");
const Candidate = require("../models/Candidate");
const { authenticate, requireAdmin } = require("../middleware/authMiddleware");

// ✅ Create election
router.post("/create-election", authenticate, requireAdmin, async (req, res) => {
  try {
    const { title, description, durationHours, durationMinutes } = req.body;
    if (!title || !description || (durationHours == null && durationMinutes == null)) {
      return res.status(400).json({ message: "Title, description, and duration are required" });
    }

    const totalDurationMinutes = Number(durationHours || 0) * 60 + Number(durationMinutes || 0);
    const now = new Date();

    // Prevent multiple active elections
    const activeElection = await Election.findOne({
      startTime: { $lte: now },
      $expr: {
        $lt: [
          { $subtract: [now, "$startTime"] },
          { $multiply: ["$duration", 60000] }
        ]
      }
    });
    if (activeElection)
      return res.status(400).json({ message: "An election is already active ⏰" });

    const election = new Election({
      title,
      description,
      duration: totalDurationMinutes,
      startTime: now,
      candidates: [],
      isActive: true, // ✅ fixed field name
    });

    await election.save();
    res.status(201).json({ message: "Election created successfully ✅", election });
  } catch (error) {
    console.error("Error creating election:", error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ Add candidate (with gender)
router.post("/add-candidate", authenticate, requireAdmin, async (req, res) => {
  try {
    const { electionId, name, gender } = req.body;
    if (!electionId || !name || !gender)
      return res.status(400).json({ message: "Election, candidate name, and gender are required" });

    // Prevent duplicate candidates (case insensitive)
    const existingCandidate = await Candidate.findOne({
      election: electionId,
      name: { $regex: new RegExp("^" + name.trim() + "$", "i") },
      gender: gender,
    });
    if (existingCandidate) {
      return res.status(400).json({ message: "Candidate already added to this election and gender" });
    }

    const candidate = new Candidate({
      name: name.trim(),
      gender,
      election: electionId,
    });

    await candidate.save();
    await Election.findByIdAndUpdate(electionId, { $push: { candidates: candidate._id } });

    res.status(201).json({ message: "Candidate added successfully ✅", candidate });
  } catch (error) {
    console.error("Error adding candidate:", error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ Fetch all elections (with candidates)
router.get("/elections", authenticate, requireAdmin, async (req, res) => {
  try {
    const elections = await Election.find().populate("candidates");
    res.json(elections);
  } catch (error) {
    console.error("Error fetching elections:", error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ Fetch active elections
router.get("/active-elections", authenticate, requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const activeElections = await Election.find({
      isActive: true, // ✅ ensure only active ones
      startTime: { $lte: now },
      $expr: {
        $lt: [
          { $subtract: [now, "$startTime"] },
          { $multiply: ["$duration", 60000] },
        ],
      },
    }).populate("candidates");

    res.json(activeElections);
  } catch (error) {
    console.error("Error fetching active elections:", error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ Election results (male/female)
router.get("/results/:electionId", authenticate, requireAdmin, async (req, res) => {
  try {
    const { electionId } = req.params;
    const election = await Election.findById(electionId);
    if (!election) return res.status(404).json({ message: "Election not found" });

    const candidates = await Candidate.find({ election: electionId });

    const maleCandidates = candidates.filter((c) => c.gender === "Male");
    const femaleCandidates = candidates.filter((c) => c.gender === "Female");

    const maleResults = await Promise.all(
      maleCandidates.map(async (candidate) => {
        const voteCount = await mongoose.model("Vote").countDocuments({ candidate: candidate._id });
        return { name: candidate.name, votes: voteCount };
      })
    );

    const femaleResults = await Promise.all(
      femaleCandidates.map(async (candidate) => {
        const voteCount = await mongoose.model("Vote").countDocuments({ candidate: candidate._id });
        return { name: candidate.name, votes: voteCount };
      })
    );

    const maleWinner = maleResults.reduce((a, b) => (a.votes > b.votes ? a : b), { votes: -1 });
    const femaleWinner = femaleResults.reduce((a, b) => (a.votes > b.votes ? a : b), { votes: -1 });

    res.json({
      election: election.title,
      maleCandidates: maleResults,
      femaleCandidates: femaleResults,
      maleWinner,
      femaleWinner,
    });
  } catch (error) {
    console.error("Error fetching results:", error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ End election early
router.put("/end-election/:electionId", authenticate, requireAdmin, async (req, res) => {
  try {
    const { electionId } = req.params;
    const election = await Election.findById(electionId);
    if (!election) return res.status(404).json({ message: "Election not found" });

    // mark inactive and zero duration to force expiry
    election.isActive = false; // ✅ fixed
    election.duration = 0;
    await election.save();

    res.json({ message: "Election ended early ✅" });
  } catch (err) {
    console.error("Error ending election:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Delete election (and its candidates)
router.delete("/delete-election/:electionId", authenticate, requireAdmin, async (req, res) => {
  try {
    const { electionId } = req.params;
    const election = await Election.findByIdAndDelete(electionId);
    if (!election) return res.status(404).json({ message: "Election not found" });

    await Candidate.deleteMany({ election: electionId });
    res.json({ message: "Election and related candidates deleted successfully ✅" });
  } catch (err) {
    console.error("Error deleting election:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Delete candidate
router.delete("/delete-candidate/:candidateId", authenticate, requireAdmin, async (req, res) => {
  try {
    const { candidateId } = req.params;
    const candidate = await Candidate.findByIdAndDelete(candidateId);
    if (!candidate) return res.status(404).json({ message: "Candidate not found" });

    await Election.updateMany({}, { $pull: { candidates: candidateId } });
    res.json({ message: "Candidate deleted successfully ✅" });
  } catch (err) {
    console.error("Error deleting candidate:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
