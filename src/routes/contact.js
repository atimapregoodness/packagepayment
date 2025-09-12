// routes/admin.js
const express = require("express");
const router = express.Router();
const Admin = require("../models/admin"); // Adjust path if needed
const isAdmin = require("../middleware/isAdmin");
const isCreator = require("../middleware/isCreator");

// Show contact info edit form
router.get("/add-contact", isAdmin || isCreator, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user._id); // Assuming admin is logged in
    if (!admin) return res.status(404).send("Admin not found");

    res.render("add-contact", { admin }); // EJS template
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Update/add contact info
router.post("/add-contact", isAdmin || isCreator, async (req, res) => {
  try {
    const { whatsapp, telegram } = req.body;

    const admin = await Admin.findById(req.user._id);
    if (!admin) return res.status(404).send("Admin not found");

    admin.contact.whatsapp = whatsapp || "";
    admin.contact.telegram = telegram || "";

    await admin.save();
    console.log(admin);
    req.flash("success", "Contact Infomation Update Successfully");
    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
