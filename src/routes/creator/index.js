// routes/creator/index.js
const express = require("express");
const router = express.Router();
const wrapAsync = require("../../utils/wrapAsync");
const isCreator = require("../../middleware/isCreator");
const Admin = require("../../models/admin");
const Client = require("../../models/client");
const cloudinary = require("cloudinary").v2; // make sure you configured cloudinary

router.use(isCreator);

// ================== GET: Creator Dashboard ==================
router.get("/dashboard", async (req, res) => {
  try {
    // Get all admins
    const admins = await Admin.find({ isAdmin: true }).lean();

    // For each admin, fetch their clients
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
    res.redirect("/creator/dashboard"); // redirect back to creator's dashboard, not /admin
  }
});

// ================== GET: Create Admin Form ==================
router.get("/create-admin", (req, res) => {
  res.render("creator/createAdmin", {
    user: req.user,
    success: req.flash("success"),
    error: req.flash("error"),
  });
});

// ================== POST: Create Admin ==================
router.post(
  "/create-admin",
  wrapAsync(async (req, res) => {
    const { username, email, password } = req.body;

    // Check if email exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      req.flash("error", "An account with this email already exists.");
      return res.redirect("/creator/create-admin");
    }

    // Create new Admin with passport-local-mongoose
    const newAdmin = new Admin({ username, email, isAdmin: true });
    await Admin.register(newAdmin, password);

    req.flash("success", "Admin account created successfully.");
    res.redirect("/creator/dashboard");
  })
);

// ================== POST: Delete Admin & Clients ==================
router.post(
  "/admins/:id/delete",
  wrapAsync(async (req, res) => {
    const adminId = req.params.id;

    // Get all clients created by this admin
    const clients = await Client.find({ author: adminId });

    // Delete client-related images from Cloudinary
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

    // Delete all clients linked to this admin
    await Client.deleteMany({ author: adminId });

    // Delete the admin
    await Admin.findByIdAndDelete(adminId);

    req.flash("success", "Admin and all their clients were deleted.");
    res.redirect("/creator/dashboard");
  })
);

module.exports = router;
