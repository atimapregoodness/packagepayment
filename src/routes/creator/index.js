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

router.post("/admins/:id/delete", async (req, res) => {
  try {
    const adminId = req.params.id;

    // Get all clients of this admin
    const clients = await Client.find({ author: adminId });

    // Delete client images (if using Cloudinary)
    for (let client of clients) {
      if (client.giftCard?.frontImageUrl) {
        try {
          await cloudinary.uploader.destroy(
            client.giftCard.frontImageUrl.split("/").pop().split(".")[0]
          );
        } catch (err) {
          console.warn("Error deleting frontImage:", err.message);
        }
      }
      if (client.giftCard?.backImageUrl) {
        try {
          await cloudinary.uploader.destroy(
            client.giftCard.backImageUrl.split("/").pop().split(".")[0]
          );
        } catch (err) {
          console.warn("Error deleting backImage:", err.message);
        }
      }
      if (client.cryptoTransaction?.slipImageUrl) {
        try {
          await cloudinary.uploader.destroy(
            client.cryptoTransaction.slipImageUrl.split("/").pop().split(".")[0]
          );
        } catch (err) {
          console.warn("Error deleting slip image:", err.message);
        }
      }
    }

    // Delete all clients linked to admin
    await Client.deleteMany({ author: adminId });

    // Delete the admin itself
    await Admin.findByIdAndDelete(adminId);

    req.flash("success", "Admin and all their clients were deleted.");
    res.redirect("/creator/dashboard");
  } catch (err) {
    console.error(err);
    req.flash("error", "Something went wrong while deleting admin.");
    res.redirect("/creator/dashboard");
  }
});

module.exports = router;
