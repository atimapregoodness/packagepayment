const express = require("express");
const router = express.Router();
const wrapAssync = require("../../utils/wrapAsync");
const isCreator = require("../../middleware/isCreator");
const isAdmin = require("../../middleware/isAdmin");
const User = require("../../models/admin");

router.get("/create-admin", isCreator, (req, res) => {
  res.render("creator/createAdmin", {
    user: req.user,
    success: req.flash("success"),
    error: req.flash("error"),
  });
});

router.get("/dashboard", isCreator, (req, res) => {
  res.render("creator/home", {
    user: req.user,
    success: req.flash("success"),
    error: req.flash("error"),
  });
});

router.post("/create-admin", isCreator, (req, res) => {
  (async () => {
    try {
      const { username, email, password } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });

      if (existingUser) {
        req.flash("error", "An account with this email already exists.");
        return res.redirect("/creator/create-admin");
      }

      // Create new admin user with isAdmin set to true
      const newUser = new User({ username, email, isAdmin: true });
      await User.register(newUser, password);

      req.flash("success", "Admin account created successfully.");
      res.redirect("/creator/dashboard");
    } catch (err) {
      req.flash("error", "Failed to create admin account.");
      res.redirect("/creator/create-admin");
    }
  })();
});

module.exports = router;
