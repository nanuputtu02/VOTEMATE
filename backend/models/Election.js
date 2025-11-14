const mongoose = require("mongoose");

const electionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  startTime: { type: Date, required: true },
  candidates: [{ type: mongoose.Schema.Types.ObjectId, ref: "Candidate" }],
  isActive: { type: Boolean, default: true } // ✅ fixed field name
}, { timestamps: true });

module.exports = mongoose.model("Election", electionSchema);
