// src/routes/email.js
const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const ejs = require("ejs");
const path = require("path");
const Email = require("../models/email");
const isMailer = require("../middleware/isMailer");

router.use(isMailer);

// === Load .env variables ===
const SITE_NAME = process.env.SITE_NAME || "Galaxy Finance";
const LOGO_URL = process.env.LOGO_URL || "/images/banner.png";
const SITE_URL = process.env.SITE_URL || "https://galaxyfnc.xyz";
const FROM_EMAIL = process.env.FROM_EMAIL || process.env.SMTP_USER;
const FROM_NAME = process.env.FROM_NAME || SITE_NAME;

// === Email validator (basic regex) ===
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

// === SMTP Transporter ===
const smtpPort = parseInt(process.env.SMTP_PORT || "465", 10);
const smtpSecure = process.env.SMTP_SECURE === "true" || smtpPort === 465;

const transporter = nodemailer.createTransport(
  {
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    logger: true,
    debug: true,
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
  },
  {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
  }
);

// Verify SMTP connection
transporter
  .verify()
  .then(() => console.log("✅ SMTP transporter verified"))
  .catch((err) =>
    console.warn("⚠️ SMTP transporter verify failed:", err.message || err)
  );

// === GET: compose form ===
router.get("/", (req, res) => {
  return res.render("form", {
    error: req.flash("error"),
    success: req.flash("success"),
    info: req.flash("info"),
    siteName: SITE_NAME,
    logoUrl: LOGO_URL,
  });
});

// === POST: send email ===
router.post("/", async (req, res) => {
  let emailDoc;

  try {
    const { to, toName, subject, body, includeDisclaimer } = req.body;

    // Validate inputs
    if (!to || !subject) {
      req.flash("error", "Recipient email and subject are required.");
      return res.redirect("/sendmail");
    }
    if (!isValidEmail(to)) {
      req.flash("error", "Invalid recipient email address.");
      return res.redirect("/sendmail");
    }

    // Save "pending" record
    emailDoc = new Email({
      to,
      toName: toName || "Galaxy Finance",
      subject,
      body: body || "",
      from: FROM_EMAIL,
      fromName: FROM_NAME,
      status: "pending",
    });
    await emailDoc.save();

    // Render EJS template
    const templatePath = path.join(
      __dirname,
      "..",
      "views",
      "email_template.ejs"
    );
    const htmlBody = await ejs.renderFile(templatePath, {
      logoUrl: LOGO_URL,
      siteName: SITE_NAME,
      siteUrl: SITE_URL,
      toName: toName || to,
      subject,
      message: body,
      includeDisclaimer: ["true", "on"].includes(includeDisclaimer),
    });

    const textFallback = `${subject}\n\n${body || ""}\n\n— ${FROM_NAME}`;

    // Send email
    const info = await transporter.sendMail({
      to,
      subject,
      text: textFallback,
      html: htmlBody,
    });

    // Update DB
    if (emailDoc) {
      emailDoc.htmlBody = htmlBody;
      emailDoc.status = "sent";
      emailDoc.sentAt = new Date();
      emailDoc.meta = {
        messageId: info.messageId,
        accepted: info.accepted,
      };
      await emailDoc.save();
    }

    req.flash("success", `Successfully sent email to: ${to}`);
    return res.redirect("/sendmail");
  } catch (err) {
    console.error("❌ Send error:", err);

    if (emailDoc) {
      try {
        emailDoc.status = "failed";
        emailDoc.error = err.message || String(err);
        await emailDoc.save();
      } catch (saveErr) {
        console.error("⚠️ Failed to update email record after error:", saveErr);
      }
    }

    let userMessage = "Failed to send email. Please try again later.";
    if (err.code === "ETIMEDOUT") {
      userMessage =
        "Connection timed out to the SMTP server. Check SMTP host/port and firewall settings.";
    } else if (err.responseCode === 535) {
      userMessage =
        "SMTP authentication failed. Please check your SMTP username/password.";
    } else if (err.message) {
      userMessage = `Failed to send email: ${err.message}`;
    }

    req.flash("error", userMessage);
    return res.redirect("/sendmail");
  }
});

module.exports = router;
