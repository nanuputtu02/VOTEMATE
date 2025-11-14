const mongoose = require('mongoose');

const CandidateSchema = new mongoose.Schema({
election: { type: mongoose.Schema.Types.ObjectId, ref: 'Election', required: true },
 name: { type: String, required: true },
 gender: { type: String, enum: ["Male", "Female"], required: true }, // <-- ADDED!
 photoUrl: String,
 description: String,
 createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Candidate', CandidateSchema);
