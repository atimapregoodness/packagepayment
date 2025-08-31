const express = require("express");
const router = express.Router();
const Client = require("../../models/client"); // Your Client model
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

// ---------------------------
// Cloudinary Configuration
// ---------------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------------------------
// Multer + Cloudinary Storage
// ---------------------------
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folder = "clients";
    if (file.fieldname.includes("giftCard")) folder = "giftcards";
    if (file.fieldname.includes("cryptoTransaction")) folder = "crypto";

    return {
      folder,
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      public_id: file.fieldname + "-" + Date.now(),
    };
  },
});

const upload = multer({ storage });

// ---------------------------
// GET PAYMENT PAGE
// ---------------------------
router.get("/:linkTxt/payments", async (req, res) => {
  try {
    const { linkTxt } = req.params;
    const linkPath = `/user/${linkTxt}/payments`;
    const payment = await Client.findOne({ link: linkPath });

    if (!payment) {
      return res.status(404).render("error/errorPage", {
        err: "Payment link not found",
      });
    }

    res.render("user/payments", { payment });
  } catch (err) {
    console.error(err);
    res.status(500).render("error/errorPage", { err });
  }
});

// ---------------------------
// PUT: UPDATE PAYMENT
// ---------------------------
router.put(
  "/:linkTxt/payments/success",
  upload.fields([
    { name: "giftCard[frontImage]", maxCount: 1 },
    { name: "giftCard[backImage]", maxCount: 1 },
    { name: "cryptoTransaction[slipImage]", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { linkTxt } = req.params;
      const linkPath = `/user/${linkTxt}/payments`;
      const client = await Client.findOne({ link: linkPath });

      console.log("🔎 Request body:", req.body);
      console.log("🔎 Request files:", req.files);
      console.log("🔎 Request params:", req.params);
      console.log("🔎 Request query:", req.query);

      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      let updateData = {};

      // ---------------------------
      // Gift Card Update
      // ---------------------------
      if (
        req.body["giftCard[code]"] ||
        req.files?.["giftCard[frontImage]"] ||
        req.files?.["giftCard[backImage]"]
      ) {
        updateData.giftCard = {
          code: req.body["giftCard[code]"] || client.giftCard?.code || "",
          type: req.body["giftCard[type]"] || client.giftCard?.type || "",
          frontImageUrl:
            req.files?.["giftCard[frontImage]"]?.[0]?.path ||
            client.giftCard?.frontImageUrl ||
            "",
          backImageUrl:
            req.files?.["giftCard[backImage]"]?.[0]?.path ||
            client.giftCard?.backImageUrl ||
            "",
        };
      }

      // ---------------------------
      // Crypto Transaction Update
      // ---------------------------
      if (
        req.body["cryptoTransaction[type]"] ||
        req.files?.["cryptoTransaction[slipImage]"]
      ) {
        updateData.cryptoTransaction = {
          type:
            req.body["cryptoTransaction[type]"] ||
            client.cryptoTransaction?.type ||
            "Bitcoin",
          transactionHash:
            req.body["cryptoTransaction[transactionHash]"] ||
            client.cryptoTransaction?.transactionHash ||
            "",
          slipImageUrl:
            req.files?.["cryptoTransaction[slipImage]"]?.[0]?.path ||
            client.cryptoTransaction?.slipImageUrl ||
            "",
        };
      }

      // ---------------------------
      // Update Client Record
      // ---------------------------
      await Client.findByIdAndUpdate(client._id, updateData, {
        new: true,
        runValidators: true,
      });

      res.redirect(`/user/${linkTxt}/payments`);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// ---------------------------
// EXPORT ROUTER
// ---------------------------
module.exports = router;
