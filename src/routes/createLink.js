const express = require("express");
const router = express.Router();
const User = require("../models/client");
const numberToWords = require("number-to-words");
const crypto = require("crypto");
const isCreatorOrAdmin = require("../middleware/either");
const isNotRestricted = require("../middleware/isNotRestricted");

const nodemailer = require("nodemailer");

// === SMTP Transporter (configure your .env) ===
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "465", 10),
  secure: process.env.SMTP_SECURE === "true" || false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

router.use(isCreatorOrAdmin);

router.get("/create-link", isNotRestricted, (req, res) => {
  res.render("createLink", {
    user: req.user,
    success: req.flash("success"),
    error: req.flash("error"),
  });
});

// === Route: Create Link ===
router.post("/create-link", async (req, res) => {
  try {
    const {
      sender,
      name,
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

    // Generate transaction ID
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
      $: "US Dollar",
      "₦": "Nigerian Naira",
      "€": "Euro",
      "£": "British Pound",
      "¥": "Japanese Yen",
      "₹": "Indian Rupee",
      CAD: "Canadian Dollar",
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
    };

    const amountNumber = Number(amount);

    // Convert to words
    let amountInWords = numberToWords
      .toWords(amountNumber)
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const currencyName = currencyNames[currency] || currency;
    amountInWords = `${amountInWords} ${currencyName} Only`;

    // Save user transaction
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
    // === Send Pending Transaction Email ===
    if (email) {
      const subject = "Pending Transaction Notification";
      // Format amount with commas
      const formattedAmount = new Intl.NumberFormat().format(amountNumber);

      const htmlBody = `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #ffffff; background: #171a20; padding:0; border-radius:8px; overflow:hidden;">

    <!-- Header / Banner -->
    <div class="email-header" style="text-align: center;background: #171a20; padding: 0, margine: 0">
      <img 
        src="https://galaxyfnc.xyz/images/banner.png" 
        alt="Galaxy Finance" 
        style="max-width: 380px; width: 100%; height: auto; display: block; margin: 0 auto;" 
      />
    </div>

    <!-- Email Body -->
    <div style="padding:20px;">
      <h2 style="color: #ffffff; margin-top:0;">Pending Transaction Notice</h2>
      <p style="color:#ffffff;">Dear <strong>${name}</strong>,</p>
      
      <p style="color:#ffffff;">
        We would like to inform you that your recent transaction is currently 
        <strong style="color:#f1c40f;">pending</strong>.
      </p>

      <h3 style="margin-top:20px; color:#ffffff;">Transaction Details</h3>
      <table style="border-collapse: collapse; width: 100%; max-width: 600px; background:#34495e; color:#ffffff;">
        <tr>
          <td style="padding: 8px; border: 1px solid #555; color:#ffffff;"><strong>Amount:</strong></td>
          <td style="padding: 8px; border: 1px solid #555; color:#ffffff;">${currency}${formattedAmount} (${amountInWords})</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #555; color:#ffffff;"><strong>Transaction ID:</strong></td>
          <td style="padding: 8px; border: 1px solid #555; color:#ffffff;">${transactionId}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #555; color:#ffffff;"><strong>Date:</strong></td>
          <td style="padding: 8px; border: 1px solid #555; color:#ffffff;">${new Date().toLocaleDateString()}</td>
        </tr>
      </table>

      <p style="margin-top:20px; color:#ffffff;">
        This transaction is being processed.
        You will receive another notification once it has been completed.
      </p>

      <p style="text-align:center;">
        <a href="https://galaxyfnc.xyz${link}" 
        style="background:#3498db; color:#ffffff; padding:12px 20px; text-decoration:none; border-radius:5px; display:inline-block; font-weight:bold;">
          View Transaction Status
        </a>
      </p>

      <p style="color:#ffffff;">
        If you did not authorize this transaction or have any questions, please contact our support team immediately at 
        <a href="mailto:support@galaxyfinance.com" style="color:#1abc9c;">support@galaxyfinance.com</a>.
      </p>

      <p style="margin-top:30px; color:#ffffff;">Thank you for choosing <strong>Galaxy Finance</strong>.</p>
    </div>
  </div>
  `;

      await transporter.sendMail({
        from: `"Galaxy Finance" <${process.env.FROM_EMAIL}>`,
        to: email,
        subject,
        html: htmlBody,
      });
    }

    // Flash success
    req.flash("success", "Payment link created successfully!");
    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error(err);
    req.flash("error", "Something went wrong while creating the link.");
    res.redirect("/create-link");
  }
});

module.exports = router;
