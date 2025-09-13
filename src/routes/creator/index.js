const express = require("express");
const router = express.Router();
const wrapAsync = require("../../utils/wrapAsync");
const isCreator = require("../../middleware/isCreator");
const Admin = require("../../models/admin");
const Client = require("../../models/client");

router.use(isCreator);

// GET: Show create admin form
router.get("/create-admin", isCreator, (req, res) => {
  res.render("creator/createAdmin", {
    user: req.user,
    success: req.flash("success"),
    error: req.flash("error"),
  });
});

// GET: Creator dashboard
router.get("/dashboard", async (req, res) => {
  try {
    const admins = await Admin.find({ isAdmin: true })
      .populate("userLinks") // assuming User has clients field OR we'll query separately
      .lean();

    // Fetch clients per admin (if you don’t have clients array in User schema)
    const adminsWithClients = await Promise.all(
      admins.map(async (admin) => {
        const clients = await Client.find({ author: admin._id }).lean();
        return { ...admin, clients };
      })
    );

    res.render("creator/home", {
      user: req.user,
      admins: adminsWithClients,
      success: req.flash("success"),
      error: req.flash("error"),
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Unable to load admins and clients.");
    res.redirect("/admin/dashboard");
  }
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
