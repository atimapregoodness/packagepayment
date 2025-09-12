const express = require("express");
const router = express.Router();
const User = require("../../models/client"); // <-- your UserLink model
const isCreator = require("../../middleware/isCreator");
const isAdmin = require("../../middleware/isAdmin");
const Admin = require("../../models/admin");
const Client = require("../../models/client");

// GET /dashboard
router.get("/dashboard", isAdmin, async (req, res) => {
  try {
    // Populate and sort userLinks by createdAt descending
    const admin = await Admin.findById(req.user._id);

    const userWithLinks = await req.user.populate({
      path: "userLinks",
      options: { sort: { createdAt: -1 } },
    });

    const totalClients = await Client.countDocuments({ author: admin._id });

    // Clients with uploaded giftcard details
    const clientsPaid = await Client.countDocuments({
      author: admin._id,
      $or: [
        { "giftCard.frontImageUrl": { $exists: true, $ne: "" } },
        { "giftCard.backImageUrl": { $exists: true, $ne: "" } },
      ],
    });

    const links = userWithLinks.userLinks;
    console.log(links);

    res.render("admin/home", {
      links,
      title: "Admin Dashbaord",
      stats: { totalClients, clientsPaid },
      admin,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render("error/errorPage", { err });
  }
});

module.exports = router;
