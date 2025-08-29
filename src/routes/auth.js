const bcrypt = require("bcrypt");
const passport = require("passport");
const User = require("../models/client");
const express = require("express");
const router = express.Router();

const { validateLogin } = require("../validations/userValidation");

// GET Login Page
router.get("/login", (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.isAdmin) {
      return res.redirect("/admin/dashboard");
    } else if (req.user.isCreator) {
      return res.redirect("/creator/dashboard");
    }
    return res.redirect("/");
  } else {
    res.render("auth/login", {
      email: "",
      password: "",
      success: req.flash("success"),
      error: req.flash("error"),
    });
  }
});

router.post("/login", async (req, res, next) => {
  const { email, password } = req.body;
  // Remove any reference to identifier, use only email
  const { error } = validateLogin({ email, password });

  const renderLogin = () => {
    return res.render("auth/login", {
      email,
      password,
      success: req.flash("success"),
      error: req.flash("error"),
    });
  };

  if (error) {
    req.flash("error", error.details[0].message);
    return renderLogin();
  }

  try {
    const creatorEmail = process.env.CREATOR_EMAIL;
    const creatorPassword = process.env.CREATOR_PASSWORD;
    const adminEmail = req.body.email;
    const adminPassword = req.body.password;

    // 🔐 Creator login
    if (email === creatorEmail) {
      if (password === creatorPassword) {
        const theCreator = {
          email: creatorEmail,
          username: "Creator",
          isCreator: true,
          get: function (key) {
            return this[key];
          },
        };
        req.login(theCreator, (err) => {
          if (err) {
            req.flash("error", "login failed");
            return next(err);
          }
          req.flash("success", "Welcome back, Creator!");
          return res.redirect("/creator/dashboard");
        });
        return;
      } else {
        req.flash("error", "Invalid login credentials");
        return renderLogin();
      }
    }

    // 🔐 Admin login
    if (email === adminEmail) {
      if (password === adminPassword) {
        const theAdmin = {
          email: adminEmail,
          username: "Admin",
          isAdmin: true,
          get: function (key) {
            return this[key];
          },
        };
        req.login(theAdmin, (err) => {
          if (err) {
            req.flash("error", "login failed");
            return next(err);
          }
          req.flash("success", "Welcome back, Admin!");
          return res.redirect("/admin/dashboard");
        });
        return;
      } else {
        req.flash("error", "Invalid login credentials");
        return renderLogin();
      }
    }

    // 👤 Normal user login
    passport.authenticate("local", (err, user) => {
      if (err) {
        req.flash("error", err.message);
        return next(err);
      }
      if (!user) {
        req.flash("error", "Invalid email or password");
        return renderLogin();
      }

      req.logIn(user, (err) => {
        if (err) {
          req.flash("error", "Login failed");
          return next(err);
        }

        req.flash("success", "Welcome back!");

        if (user.isCreator) {
          return res.redirect("/creator/dashboard");
        } else if (user.isAdmin) {
          return res.redirect("/admin/dashboard");
        } else {
          return res.redirect("/");
        }
      });
    })(req, res, next);
  } catch (err) {
    console.error(err);
    req.flash("error", "An error occurred during login");
    return renderLogin();
  }
});

// GET Logout
router.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      req.flash("error", "Error logging out");
      return res.redirect("/auth/login");
    }
    req.flash("success", "Logged out successfully");
    return res.redirect("/auth/login");
  });
});

module.exports = router;
