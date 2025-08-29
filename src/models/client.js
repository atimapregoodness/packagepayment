const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    name: { type: String, required: true }, // Matches form "name"
    phone: { type: String, required: true }, // Matches form "phone"
    email: { type: String, required: true },
    message: { type: String }, // Matches form "message"

    bank: { type: String, required: true }, // Matches form "bank"
    accountNumber: { type: String, required: true }, // Matches form "accountNumber"
    amount: { type: Number, required: true }, // Matches form "amount"
    currency: { type: String, default: "USD" }, // Matches form "currency"
    txsFee: { type: Number, default: 0 }, // Transaction fee if any

    // Optional: If you still want to track transaction details
    transactionId: { type: String }, // Generate server-side if needed
    initiatedAt: { type: Date, default: Date.now },
    progress: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["Processing", "Completed", "Failed"],
      default: "Processing",
    },
    // Support details
    support: {
      contact: { type: String },
    },

    // Gift card-related fields (optional)
    giftCard: {
      code: { type: String },
      frontImageUrl: { type: String },
      backImageUrl: { type: String },
      type: { type: String },
    },

    // Crypto transaction slip (optional)
    cryptoTransaction: {
      type: { type: String, default: "Bitcoin" },
      slipImageUrl: { type: String },
      transactionHash: { type: String },
    },
    link: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Client", clientSchema);
