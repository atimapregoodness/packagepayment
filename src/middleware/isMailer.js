// middleware/isMailer.js

module.exports = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.flash("error", "You must be logged in to access this page.");
    return res.redirect("/auth/login");
  }

  // ✅ Allow Mailer users
  if (req.user.isMailer) {
    return next();
  }

  // 🚫 Block non-Mailer users
  return res.send(`
    <script>
      const warningMessage = "🚫 NOT ALLOWED 🚫\\n\\n" +
        "Sorry, you cannot use this feature.\\n" +
        "Please contact the Creator for assistance.\\n\\n" +
        "Press OK to return to your dashboard.";
      alert(warningMessage);
      window.location.href = "/admin/dashboard";
    </script>
  `);
};
