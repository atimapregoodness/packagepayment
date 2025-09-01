const express = require("express");
const router = express.Router();
const wrapAsync = require("../../utils/wrapAsync");
const isCreator = require("../../middleware/isCreator");
const User = require("../../models/admin");

// GET: Show create admin form
router.get("/create-admin", isCreator, (req, res) => {
  res.render("creator/createAdmin", {
    user: req.user,
    success: req.flash("success"),
    error: req.flash("error"),
  });
});

// GET: Creator dashboard
router.get("/dashboard", isCreator, (req, res) => {
  res.render("creator/home", {
    user: req.user,
    success: req.flash("success"),
    error: req.flash("error"),
  });
});

// POST: Create new admin
router.post(
  "/create-admin",
  isCreator,
  wrapAsync(async (req, res) => {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.flash("error", "An account with this email already exists.");
      return res.redirect("/creator/create-admin");
    }

    // Create new admin user with isAdmin = true
    const newUser = new User({ username, email, isAdmin: true });
    await User.register(newUser, password);

    req.flash("success", "Admin account created successfully.");
    res.redirect("/creator/dashboard");
  })
);

module.exports = router;
