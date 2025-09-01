if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const mongoose = require("mongoose");
const Creator = require("../models/admin");

const seedCreator = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Creator Database connected successfully");

    const CREATOR_EMAIL = process.env.CREATOR_EMAIL;
    const CREATOR_PASSWORD = process.env.CREATOR_PASSWORD;

    if (!CREATOR_EMAIL || !CREATOR_PASSWORD) {
      throw new Error("Missing CREATOR_EMAIL or CREATOR_PASSWORD in .env");
    }

    const existing = await Creator.findOne({ email: CREATOR_EMAIL });
    if (existing) {
      console.log("⚠️ Creator already exists.");
      return;
    }

    const newCreator = new Creator({
      username: "Creator",
      email: CREATOR_EMAIL,
      isCreator: true,
    });

    await Creator.register(newCreator, CREATOR_PASSWORD);
    console.log("✅ Creator user created successfully!");
  } catch (err) {
    console.error("❌ Error creating Creator user:", err);
  } finally {
    await mongoose.disconnect();
  }
};

seedCreator();
