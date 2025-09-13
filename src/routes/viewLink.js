const express = require("express");
const router = express.Router();
const isCreator = require("../middleware/isCreator");
const isAdmin = require("../middleware/isAdmin");
const Client = require("../models/client");
const isCreatorOrAdmin = require("../middleware/either");
router.use(isCreatorOrAdmin);

router.get("/link-info/:transactionId", async (req, res) => {
  try {
    const client = await Client.findOne({
      transactionId: req.params.transactionId,
    });

    if (!client) {
      return res
        .status(404)
        .send("<p class='text-danger'>Client not found</p>");
    }

    // Render only the partial
    res.render("clientDetails", { client });

    // res.send(client);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .send("<p class='text-danger'>Server error loading details</p>");
  }
});

module.exports = router;
