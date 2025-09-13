const express = require("express");
const router = express.Router();
const User = require("../models/client");
const numberToWords = require("number-to-words");
const crypto = require("crypto");
const isCreatorOrAdmin = require("../middleware/either");
const isNotRestricted = require("../middleware/isNotRestricted");
router.use(isCreatorOrAdmin);

router.get("/create-link", isNotRestricted, (req, res) => {
  res.render("createLink", {
    user: req.user,
    success: req.flash("success"),
    error: req.flash("error"),
  });
});

router.post("/create-link", async (req, res) => {
  try {
    const {
      sender,
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

    const currencyNames = {
      $: "US Dollar", // NOTE: "$" also used by CAD, AUD, MXN (see below)
      "₦": "Nigerian Naira",
      "€": "Euro",
      "£": "British Pound",
      "¥": "Japanese Yen",
      "₹": "Indian Rupee",
      CAD: "Canadian Dollar", // handle same $ symbol uniquely by value
      AUD: "Australian Dollar",
      MXN: "Mexican Peso",
      R: "South African Rand",
      KSh: "Kenyan Shilling",
      "₵": "Ghanaian Cedi",
      "﷼": "Saudi Riyal",
      R$: "Brazilian Real",
      "₽": "Russian Ruble",
      Fr: "Swiss Franc",
      "₨": "Pakistani Rupee",
      "৳": "Bangladeshi Taka",
      Rp: "Indonesian Rupiah",
      "₱": "Philippine Peso",
      "د.إ": "UAE Dirham",
      // add more as needed
    };

    const amountNumber = Number(amount);

    // Convert amount number into words
    let amountInWords = numberToWords
      .toWords(amountNumber)
      .replace(/\b\w/g, (c) => c.toUpperCase());

    // Get the currency name based on the symbol
    const currencyName = currencyNames[currency] || currency;

    amountInWords = `${amountInWords} ${currencyName} Only`;

    const newUser = new User({
      author: req.user._id,
      sender,
      name,
      phone,
      email,
      message,
      bank,
      amount,
      amountInWords,
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
