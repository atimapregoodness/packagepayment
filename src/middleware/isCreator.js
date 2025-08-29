// middleware/isAdmin.js

module.exports = (req, res, next) => {
  if (req.isAuthenticated() && req.user.isCreator) {
    return next(); // ✅ Allow access
  }

  req.flash("error", "You do not have permission to view this page.");
  return res.redirect("/auth/login"); // or another route you prefer
};
