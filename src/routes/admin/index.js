const express = require("express");
const router = express.Router();
const User = require("../../models/client"); // <-- your UserLink model
const isCreator = require("../../middleware/isCreator");
const isAdmin = require("../../middleware/isAdmin");

// Middleware to check if user is authenticated
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash("error", "Please log in to view that resource");
  res.redirect("/auth/login");
}

// GET /dashboard
router.get("/dashboard", ensureAuthenticated, async (req, res) => {
  try {
    // Populate and sort userLinks by createdAt descending
    const userWithLinks = await req.user.populate({
      path: "userLinks",
      options: { sort: { createdAt: -1 } },
    });

    const links = userWithLinks.userLinks;
    console.log(links);

    res.render("admin/home", { links });
  } catch (err) {
    console.error(err);
    res.status(500).render("error/errorPage", { err });
  }
});

module.exports = router;
