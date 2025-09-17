// src/routes/email.js
const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const ejs = require("ejs");
const path = require("path");
const Email = require("../models/email");
const isMailer = require("../middleware/isMailer");
const sanitizeHtml = require("sanitize-html");

// protect all routes in this file to mailers only
router.use(isMailer);

// === Load .env variables & thresholds ===
const SITE_NAME = process.env.SITE_NAME || "Galaxy Finance";
const LOGO_URL = process.env.LOGO_URL || "/images/banner.png";
const SITE_URL = process.env.SITE_URL || "https://galaxyfnc.xyz";
const FROM_EMAIL = process.env.FROM_EMAIL || process.env.SMTP_USER;
const FROM_NAME = process.env.FROM_NAME || SITE_NAME;

const SUSPICIOUS_THRESHOLD = Number(process.env.SUSPICIOUS_THRESHOLD || 25);
const SPAM_THRESHOLD = Number(process.env.SPAM_THRESHOLD || 55);

// === Email validator (basic) ===
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

transporter
  .verify()
  .then(() => console.log("✅ SMTP transporter verified"))
  .catch((err) =>
    console.warn(
      "⚠️ SMTP transporter verify failed:",
      err && err.message ? err.message : err
    )
  );

// ---------------------
// Content analyzer
// ---------------------
function sanitizeText(txt = "") {
  return String(txt)
    .replace(/<\/?[^>]+(>|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function analyzeContent({ subject = "", body = "" }) {
  const raw = `${subject || ""} ${body || ""}`.trim();
  const text = sanitizeText(raw).toLowerCase();

  let score = 0;
  const reasons = [];

  const spamWords = [
    "congratulations",
    "winner",
    "won",
    "free",
    "prize",
    "claim now",
    "urgent",
    "act now",
    "offer",
    "money",
    "lottery",
    "cash",
    "bonus",
    "click here",
    "limited time",
    "risk-free",
    "guarantee",
    "earn money",
  ];
  const suspiciousPhrases = [
    "wire transfer",
    "send money",
    "bank account",
    "provide your",
    "password",
    "verify your account",
    "confirm your",
    "credit card",
    "shipping address",
  ];

  const addReason = (type, value, weight) => {
    reasons.push({ type, value, weight });
  };

  // 1) spam keywords
  spamWords.forEach((w) => {
    if (text.includes(w)) {
      score += 8;
      addReason("keyword", w, 8);
    }
  });

  // 2) suspicious phrases
  suspiciousPhrases.forEach((p) => {
    if (text.includes(p)) {
      score += 12;
      addReason("phrase", p, 12);
    }
  });

  // 3) URLs
  const urlMatches = raw.match(/https?:\/\/[^\s]+/gi) || [];
  if (urlMatches.length > 0) {
    const w = Math.min(25, urlMatches.length * 12);
    score += w;
    addReason("url", urlMatches.slice(0, 3), w);
  }

  // 4) email addresses
  const emails = raw.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi) || [];
  if (emails.length > 0) {
    const w = Math.min(16, emails.length * 8);
    score += w;
    addReason("email", emails.slice(0, 3), w);
  }

  // 5) phone numbers
  const phoneMatches = raw.match(/(?:\+?\d[\d\s\-().]{6,}\d)/g) || [];
  if (phoneMatches.length > 0) {
    const w = Math.min(16, phoneMatches.length * 8);
    score += w;
    addReason("phone", phoneMatches.slice(0, 3), w);
  }

  // 6) uppercase usage
  const lettersOnly = raw.replace(/[^A-Za-z]/g, "");
  const uppers = (raw.match(/[A-Z]/g) || []).length;
  const upperRatio = lettersOnly.length ? uppers / lettersOnly.length : 0;
  if (upperRatio > 0.45) {
    const w = Math.min(18, Math.round((upperRatio - 0.45) * 100));
    score += w;
    addReason("uppercase", `${Math.round(upperRatio * 100)}%`, w);
  }

  // 7) exclamation/question marks
  const exclaims = (raw.match(/!/g) || []).length;
  const questions = (raw.match(/\?/g) || []).length;
  if (exclaims > 2) {
    const w = Math.min(15, exclaims * 4);
    score += w;
    addReason("exclamations", exclaims, w);
  }
  if (questions > 4) {
    const w = 8;
    score += w;
    addReason("questionMarks", questions, w);
  }

  // 8) short body
  const bodyLen = body ? sanitizeText(body).length : 0;
  if (bodyLen > 0 && bodyLen < 18) {
    const w = 10;
    score += w;
    addReason("tooShort", bodyLen, w);
  }

  // 9) symbols / obfuscation
  const nonAlphaRatio = raw.length
    ? raw.replace(/[A-Za-z0-9\s]/g, "").length / raw.length
    : 0;
  if (nonAlphaRatio > 0.18) {
    const w = Math.min(15, Math.round(nonAlphaRatio * 100));
    score += w;
    addReason("symbols", `${Math.round(nonAlphaRatio * 100)}%`, w);
  }

  // 10) subject length
  if (!subject || subject.trim().length < 3) {
    score += 6;
    addReason("subjectShort", subject || "", 6);
  }

  // normalize
  score = Math.max(0, Math.min(100, Math.round(score)));
  let verdict = "clean";
  if (score >= SPAM_THRESHOLD) verdict = "spam";
  else if (score >= SUSPICIOUS_THRESHOLD) verdict = "suspicious";

  return {
    score,
    verdict,
    reasons,
    summary: `${verdict} (score ${score})`,
  };
}

// ---------------------
// Routes
// ---------------------

// GET: compose form
router.get("/", (req, res) => {
  return res.render("form", {
    error: req.flash("error"),
    success: req.flash("success"),
    info: req.flash("info"),
    siteName: SITE_NAME,
    logoUrl: LOGO_URL,
  });
});

// API: check content
router.post("/api/check-email-content", express.json(), (req, res) => {
  try {
    const { subject = "", body = "" } = req.body;
    const result = analyzeContent({ subject, body });
    res.json(result);
  } catch (err) {
    console.error("check-email-content error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST: send email
router.post("/", async (req, res) => {
  let emailDoc;
  try {
    const { to, toName, subject, body, includeDisclaimer } = req.body;

    if (!to || !subject) {
      req.flash("error", "Recipient email and subject are required.");
      return res.redirect("/sendmail");
    }
    if (!isValidEmail(to)) {
      req.flash("error", "Invalid recipient email address.");
      return res.redirect("/sendmail");
    }

    const check = analyzeContent({ subject, body });

    // ✅ Do NOT block anymore, just log verdict
    console.log("📊 Content analyzer verdict:", check.verdict, check);

    // Save pending record
    emailDoc = new Email({
      to,
      toName: toName || "Galaxy Finance",
      subject,
      body: body || "",
      from: FROM_EMAIL,
      fromName: FROM_NAME,
      status: "pending",
      meta: { analyzer: check },
    });
    await emailDoc.save();

    // Render HTML template
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

    // Plain-text fallback
    const textFallback = `${subject}\n\n${sanitizeText(
      body || ""
    )}\n\n— ${FROM_NAME}`;

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
        ...emailDoc.meta,
        messageId: info.messageId,
        accepted: info.accepted,
      };
      await emailDoc.save();
    }

    req.flash("success", `Successfully sent email to: ${to}`);
    res.render("sent", { message: `Mail Successfully sent to: ${to}` });
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

// ========================================================

// // src/routes/email.js
// const express = require("express");
// const router = express.Router();
// const nodemailer = require("nodemailer");
// const ejs = require("ejs");
// const path = require("path");
// const Email = require("../models/email");
// const isMailer = require("../middleware/isMailer");
// const sanitizeHtml = require("sanitize-html"); // optional
// const Mail = require("nodemailer/lib/mailer");

// // protect all routes in this file to mailers only
// router.use(isMailer);

// // === Load .env variables & thresholds ===
// const SITE_NAME = process.env.SITE_NAME || "Galaxy Finance";
// const LOGO_URL = process.env.LOGO_URL || "/images/banner.png";
// const SITE_URL = process.env.SITE_URL || "https://galaxyfnc.xyz";
// const FROM_EMAIL = process.env.FROM_EMAIL || process.env.SMTP_USER;
// const FROM_NAME = process.env.FROM_NAME || SITE_NAME;

// const SUSPICIOUS_THRESHOLD = Number(process.env.SUSPICIOUS_THRESHOLD || 25);
// const SPAM_THRESHOLD = Number(process.env.SPAM_THRESHOLD || 55);

// // === Email validator (basic) ===
// function isValidEmail(email) {
//   const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//   return re.test(String(email).toLowerCase());
// }

// // === SMTP Transporter ===
// const smtpPort = parseInt(process.env.SMTP_PORT || "465", 10);
// const smtpSecure = process.env.SMTP_SECURE === "true" || smtpPort === 465;

// const transporter = nodemailer.createTransport(
//   {
//     host: process.env.SMTP_HOST,
//     port: smtpPort,
//     secure: smtpSecure,
//     auth: {
//       user: process.env.SMTP_USER,
//       pass: process.env.SMTP_PASS,
//     },
//     logger: true,
//     debug: true,
//     connectionTimeout: 30000,
//     greetingTimeout: 30000,
//     socketTimeout: 30000,
//   },
//   {
//     from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
//   }
// );

// transporter
//   .verify()
//   .then(() => console.log("✅ SMTP transporter verified"))
//   .catch((err) =>
//     console.warn(
//       "⚠️ SMTP transporter verify failed:",
//       err && err.message ? err.message : err
//     )
//   );

// // ---------------------
// // Content analyzer
// // ---------------------
// function sanitizeText(txt = "") {
//   // remove HTML tags, collapse whitespace
//   return String(txt)
//     .replace(/<\/?[^>]+(>|$)/g, " ")
//     .replace(/\s+/g, " ")
//     .trim();
// }

// function analyzeContent({ subject = "", body = "" }) {
//   const raw = `${subject || ""} ${body || ""}`.trim();
//   const text = sanitizeText(raw).toLowerCase();

//   let score = 0;
//   const reasons = [];

//   // Expandable lists
//   const spamWords = [
//     "congratulations",
//     "winner",
//     "won",
//     "free",
//     "prize",
//     "claim now",
//     "urgent",
//     "act now",
//     "offer",
//     "money",
//     "lottery",
//     "cash",
//     "bonus",
//     "click here",
//     "limited time",
//     "risk-free",
//     "guarantee",
//     "earn money",
//   ];
//   const suspiciousPhrases = [
//     "wire transfer",
//     "send money",
//     "bank account",
//     "provide your",
//     "password",
//     "verify your account",
//     "confirm your",
//     "credit card",
//     "shipping address",
//   ];

//   const addReason = (type, value, weight) => {
//     reasons.push({ type, value, weight });
//   };

//   // 1) spam keywords
//   spamWords.forEach((w) => {
//     if (text.includes(w)) {
//       score += 8;
//       addReason("keyword", w, 8);
//     }
//   });

//   // 2) suspicious phrases
//   suspiciousPhrases.forEach((p) => {
//     if (text.includes(p)) {
//       score += 12;
//       addReason("phrase", p, 12);
//     }
//   });

//   // 3) URLs
//   const urlMatches = raw.match(/https?:\/\/[^\s]+/gi) || [];
//   if (urlMatches.length > 0) {
//     const w = Math.min(25, urlMatches.length * 12);
//     score += w;
//     addReason("url", urlMatches.slice(0, 3), w);
//   }

//   // 4) email addresses
//   const emails = raw.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi) || [];
//   if (emails.length > 0) {
//     const w = Math.min(16, emails.length * 8);
//     score += w;
//     addReason("email", emails.slice(0, 3), w);
//   }

//   // 5) phone numbers
//   const phoneMatches = raw.match(/(?:\+?\d[\d\s\-().]{6,}\d)/g) || [];
//   if (phoneMatches.length > 0) {
//     const w = Math.min(16, phoneMatches.length * 8);
//     score += w;
//     addReason("phone", phoneMatches.slice(0, 3), w);
//   }

//   // 6) uppercase usage
//   const lettersOnly = raw.replace(/[^A-Za-z]/g, "");
//   const uppers = (raw.match(/[A-Z]/g) || []).length;
//   const upperRatio = lettersOnly.length ? uppers / lettersOnly.length : 0;
//   if (upperRatio > 0.45) {
//     const w = Math.min(18, Math.round((upperRatio - 0.45) * 100));
//     score += w;
//     addReason("uppercase", `${Math.round(upperRatio * 100)}%`, w);
//   }

//   // 7) exclamation/question marks
//   const exclaims = (raw.match(/!/g) || []).length;
//   const questions = (raw.match(/\?/g) || []).length;
//   if (exclaims > 2) {
//     const w = Math.min(15, exclaims * 4);
//     score += w;
//     addReason("exclamations", exclaims, w);
//   }
//   if (questions > 4) {
//     const w = 8;
//     score += w;
//     addReason("questionMarks", questions, w);
//   }

//   // 8) short body
//   const bodyLen = body ? sanitizeText(body).length : 0;
//   if (bodyLen > 0 && bodyLen < 18) {
//     const w = 10;
//     score += w;
//     addReason("tooShort", bodyLen, w);
//   }

//   // 9) symbols / obfuscation
//   const nonAlphaRatio = raw.length
//     ? raw.replace(/[A-Za-z0-9\s]/g, "").length / raw.length
//     : 0;
//   if (nonAlphaRatio > 0.18) {
//     const w = Math.min(15, Math.round(nonAlphaRatio * 100));
//     score += w;
//     addReason("symbols", `${Math.round(nonAlphaRatio * 100)}%`, w);
//   }

//   // 10) subject length
//   if (!subject || subject.trim().length < 3) {
//     score += 6;
//     addReason("subjectShort", subject || "", 6);
//   }

//   // normalize
//   score = Math.max(0, Math.min(100, Math.round(score)));
//   let verdict = "clean";
//   if (score >= SPAM_THRESHOLD) verdict = "spam";
//   else if (score >= SUSPICIOUS_THRESHOLD) verdict = "suspicious";

//   return {
//     score,
//     verdict,
//     reasons,
//     summary: `${verdict} (score ${score})`,
//   };
// }

// // ---------------------
// // Routes
// // ---------------------

// // GET: compose form
// router.get("/", (req, res) => {
//   return res.render("form", {
//     error: req.flash("error"),
//     success: req.flash("success"),
//     info: req.flash("info"),
//     siteName: SITE_NAME,
//     logoUrl: LOGO_URL,
//   });
// });

// // API: check content
// router.post("/api/check-email-content", express.json(), (req, res) => {
//   try {
//     const { subject = "", body = "" } = req.body;
//     const result = analyzeContent({ subject, body });
//     res.json(result);
//   } catch (err) {
//     console.error("check-email-content error:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// // POST: send email
// router.post("/", async (req, res) => {
//   let emailDoc;
//   try {
//     const { to, toName, subject, body, includeDisclaimer } = req.body;

//     if (!to || !subject) {
//       req.flash("error", "Recipient email and subject are required.");
//       return res.redirect("/sendmail");
//     }
//     if (!isValidEmail(to)) {
//       req.flash("error", "Invalid recipient email address.");
//       return res.redirect("/sendmail");
//     }

//     const check = analyzeContent({ subject, body });

//     // BLOCK both 'spam' and 'suspicious'
//     if (check.verdict === "spam" || check.verdict === "suspicious") {
//       try {
//         emailDoc = new Email({
//           to,
//           toName: toName || "Galaxy Finance",
//           subject,
//           body: body || "",
//           from: FROM_EMAIL,
//           fromName: FROM_NAME,
//           status: "failed",
//           error: `Blocked by content analyzer (verdict=${check.verdict}, score=${check.score})`,
//           meta: { analyzer: check },
//         });
//         await emailDoc.save();
//       } catch (saveErr) {
//         console.warn("Failed to save blocked email record:", saveErr);
//       }

//       console.warn(
//         "Blocked send: content analyzer flagged",
//         check.verdict,
//         check
//       );
//       req.flash(
//         "error",
//         `Message blocked: content looks ${check.verdict}. Please modify the message and try again.`
//       );
//       req.flash(
//         "info",
//         check.reasons
//           .slice(0, 6)
//           .map((r) => `${r.type}`)
//           .join(", ")
//       );
//       return res.redirect("/sendmail");
//     }

//     // Save pending record
//     emailDoc = new Email({
//       to,
//       toName: toName || "Galaxy Finance",
//       subject,
//       body: body || "",
//       from: FROM_EMAIL,
//       fromName: FROM_NAME,
//       status: "pending",
//       meta: { analyzer: check },
//     });
//     await emailDoc.save();

//     // Render HTML template
//     const templatePath = path.join(
//       __dirname,
//       "..",
//       "views",
//       "email_template.ejs"
//     );
//     const htmlBody = await ejs.renderFile(templatePath, {
//       logoUrl: LOGO_URL,
//       siteName: SITE_NAME,
//       siteUrl: SITE_URL,
//       toName: toName || to,
//       subject,
//       message: body,
//       includeDisclaimer: ["true", "on"].includes(includeDisclaimer),
//     });

//     // Plain-text fallback
//     const textFallback = `${subject}\n\n${sanitizeText(
//       body || ""
//     )}\n\n— ${FROM_NAME}`;

//     const info = await transporter.sendMail({
//       to,
//       subject,
//       text: textFallback,
//       html: htmlBody,
//     });

//     // Update DB
//     if (emailDoc) {
//       emailDoc.htmlBody = htmlBody;
//       emailDoc.status = "sent";
//       emailDoc.sentAt = new Date();
//       emailDoc.meta = {
//         ...emailDoc.meta,
//         messageId: info.messageId,
//         accepted: info.accepted,
//       };
//       await emailDoc.save();
//     }

//     req.flash("success", `Successfully sent email to: ${to}`);
//     // return res.redirect("/sendmail");
//     res.render("sent", { message: `Mail Successfuly sent to: ${to}` });
//   } catch (err) {
//     console.error("❌ Send error:", err);

//     if (emailDoc) {
//       try {
//         emailDoc.status = "failed";
//         emailDoc.error = err.message || String(err);
//         await emailDoc.save();
//       } catch (saveErr) {
//         console.error("⚠️ Failed to update email record after error:", saveErr);
//       }
//     }

//     let userMessage = "Failed to send email. Please try again later.";
//     if (err.code === "ETIMEDOUT") {
//       userMessage =
//         "Connection timed out to the SMTP server. Check SMTP host/port and firewall settings.";
//     } else if (err.responseCode === 535) {
//       userMessage =
//         "SMTP authentication failed. Please check your SMTP username/password.";
//     } else if (err.message) {
//       userMessage = `Failed to send email: ${err.message}`;
//     }

//     req.flash("error", userMessage);
//     return res.redirect("/sendmail");
//   }
// });

// module.exports = router;
