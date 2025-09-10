const express = require("express");
const router = express.Router();
const isCreator = require("../middleware/isCreator");
const isAdmin = require("../middleware/isAdmin");
const User = require("../models/client");
const crypto = require("crypto");

router.get("/create-link", isAdmin || isCreator, (req, res) => {
  res.render("createLink", {
    user: req.user,
    success: req.flash("success"),
    error: req.flash("error"),
  });
});

router.post("/create-link", async (req, res) => {
  try {
    const {
      name, // from form
      phone,
      email,
      message,
      bank,
      amount,
      currency,
      progress,
      accountNumber,
      txsFee,
    } = req.body;

    // Function to generate a transaction ID like galaxy-7829-4882K-02912
    function generateTransactionId() {
      const prefix = "TLGF";
      const randomPart = (length) => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let result = "";
        for (let i = 0; i < length; i++) {
          const randomIndex = crypto.randomInt(0, chars.length);
          result += chars[randomIndex];
        }
        return result;
      };
      const part1 = randomPart(4);
      const part2 = randomPart(5);
      const part3 = randomPart(5);
      return `${prefix}-${part1}-${part2}-${part3}`;
    }

    const usernameSlug = name.trim().toLowerCase().replace(/\s+/g, "-");
    const transactionId = generateTransactionId();
    const linkTxt = `${usernameSlug}-${transactionId}`;
    const link = `/user/${linkTxt}/payments`;

    const newUser = new User({
      author: req.user._id,
      name,
      phone,
      email,
      message,
      bank,
      amount,
      currency,
      link,
      progress,
      transactionId,
      accountNumber,
      txsFee,
    });

    await newUser.save();

    req.user.userLinks = req.user.userLinks || [];
    req.user.userLinks.push(newUser._id);
    await req.user.save();

    // Flash message for success
    req.flash("success", "Payment link created successfully!");
    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error(err);
    // Flash message for error
    req.flash("error", "Something went wrong while creating the link.");
    res.redirect("/create-link");
  }
});

module.exports = router;
