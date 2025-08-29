const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const { Schema } = mongoose;

const adminSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  username: {
    type: String,
    required: true
  },
  userLinks: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
    },
  ],
  isAdmin: {
    type: Boolean,
    default: false,
  },
  isCreator: {
    type: Boolean,
    default: false,
  },
  createdAt: { type: Date, default: Date.now },
});

// Use passport-local-mongoose to handle password hashing and authentication
adminSchema.plugin(passportLocalMongoose, { usernameField: "email" });

module.exports = mongoose.model("Admin", adminSchema);
