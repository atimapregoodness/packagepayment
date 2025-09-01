const express = require("express");
const router = express.Router();
const isCreator = require("../middleware/isCreator");
const isAdmin = require("../middleware/isAdmin");
const Client = require("../models/client");

// const User = require("../models/client");
// const crypto = require("crypto");

router.get("/link-info/:txId", isAdmin || isCreator, async (req, res) => {
  const { txId } = req.params;
  const client = await Client.findOne({ transactionId: txId }).populate(
    "author"
  );

  console.log(client);

  res.render("clientDetails", { client, showLayout: false });
});

module.exports = router;
