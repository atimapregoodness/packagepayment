const mongoose = require("mongoose");

const EmailSchema = new mongoose.Schema({
  to: { type: String, required: true },
  toName: { type: String },
  subject: { type: String, required: true },
  body: { type: String }, // plaintext or short note
  htmlBody: { type: String }, // rendered HTML sent out
  from: { type: String, default: process.env.FROM_EMAIL },
  fromName: {
    type: String,
    default: process.env.FROM_NAME || "Galaxy Finance",
  },
  status: {
    type: String,
    enum: ["pending", "sent", "failed"],
    default: "pending",
  },
  error: { type: String },
  createdAt: { type: Date, default: Date.now },
  sentAt: { type: Date },
});

module.exports = mongoose.model("Email", EmailSchema);
