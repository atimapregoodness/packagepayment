// routes/user/payments.js
const express = require("express");
const router = express.Router();
const Client = require("../../models/client");
const Admin = require("../../models/admin");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;
const isAdmin = require("../../middleware/isAdmin");
const isCreator = require("../../middleware/isCreator");
const isNotRestricted = require("../../middleware/isNotRestricted");

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
      transformation: [
        { width: 600, crop: "scale" }, // reduce width more
        { quality: "auto:low" }, // stronger compression
        { fetch_format: "auto" }, // serve as WebP/AVIF when possible
      ],
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
    const payment = await Client.findOne({ link: linkPath }).populate("author");

    if (!payment) {
      req.flash("error_msg", "Payment link not found");
      return res.redirect("/error");
    }

    res.render("user/payments", { payment });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Something went wrong. Please try again.");
    return res.redirect("/error");
  }
});

// ---------------------------
// POST: SEARCH TXS BY ID
// ---------------------------
router.post("/txs", async (req, res) => {
  try {
    const txsId = req.body.txsId;
    const getLink = await Client.findOne({ transactionId: txsId });

    if (!getLink) {
      req.flash(
        "error",
        "Payment for this ID could not be found. Please verify the ID."
      );
      return res.redirect("/home");
    }

    return res.redirect(`${getLink.link}`);
  } catch (err) {
    console.error(err);
    req.flash(
      "error",
      "An error occurred while processing your request. Please try again."
    );
    return res.redirect("/home");
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
      if (!client) {
        req.flash("error_msg", "Client not found.");
        return res.redirect(`/user/${linkTxt}/payments`);
      }

      let updateData = {};

      // Gift Card Update
      if (
        req.body.giftCard?.code ||
        req.body.giftCard?.type ||
        req.files?.["giftCard[frontImage]"] ||
        req.files?.["giftCard[backImage]"]
      ) {
        updateData.giftCard = {
          code: req.body.giftCard?.code || client.giftCard?.code || "",
          type: req.body.giftCard?.type || client.giftCard?.type || "",
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

      // Crypto Transaction Update
      if (
        req.body.cryptoTransaction?.type ||
        req.body.cryptoTransaction?.transactionHash ||
        req.files?.["cryptoTransaction[slipImage]"]
      ) {
        updateData.cryptoTransaction = {
          type:
            req.body.cryptoTransaction?.type ||
            client.cryptoTransaction?.type ||
            "Bitcoin",
          transactionHash:
            req.body.cryptoTransaction?.transactionHash ||
            client.cryptoTransaction?.transactionHash ||
            "",
          slipImageUrl:
            req.files?.["cryptoTransaction[slipImage]"]?.[0]?.path ||
            client.cryptoTransaction?.slipImageUrl ||
            "",
        };
      }

      await Client.findByIdAndUpdate(client._id, updateData, {
        new: true,
        runValidators: true,
      });

      req.flash("success_msg", "Payment updated successfully ✅");
      return res.redirect(`/user/${linkTxt}/payments`);
    } catch (err) {
      console.error("Update payment error:", err);
      req.flash("error_msg", "Server error. Please try again.");
      return res.redirect("back");
    }
  }
);

// ---------------------------
// UPDATE TRANSACTION STATUS
// ---------------------------
router.get(
  "/update-transaction/:id",
  isAdmin,
  isNotRestricted,
  async (req, res) => {
    try {
      const { status } = req.query;
      const validStatuses = ["successful", "declined", "initiated"];

      if (!status || !validStatuses.includes(status.toLowerCase())) {
        return res.status(400).send("Invalid status.");
      }

      const client = await Client.findByIdAndUpdate(
        req.params.id,
        { status: status.toLowerCase() },
        { new: true }
      );

      if (!client) {
        return res.status(404).send("Client not found.");
      }

      return res.redirect(`/link-info/${client.transactionId}`);
    } catch (err) {
      console.error(err);
      return res.status(500).send("Server error.");
    }
  }
);

// ---------------------------
// DELETE CLIENT TRANSACTION
// ---------------------------
router.get(
  "/delete-transaction/:id",
  isAdmin,
  isNotRestricted,
  async (req, res) => {
    try {
      const { id } = req.params;
      const client = await Client.findById(id);

      if (!client) {
        req.flash("error", "Client transaction not found.");
        return res.redirect("/admin/dashboard");
      }

      const imagesToDelete = [];
      if (client.giftCard?.frontImageUrl)
        imagesToDelete.push(client.giftCard.frontImageUrl);
      if (client.giftCard?.backImageUrl)
        imagesToDelete.push(client.giftCard.backImageUrl);
      if (client.cryptoTransaction?.slipImageUrl)
        imagesToDelete.push(client.cryptoTransaction.slipImageUrl);

      // Delete Cloudinary images safely
      for (const imageUrl of imagesToDelete) {
        try {
          const parts = imageUrl.split("/");
          const folderAndFile = parts.slice(-2).join("/"); // keep folder + file
          const publicId = folderAndFile.split(".")[0];
          await cloudinary.uploader.destroy(publicId);
        } catch (err) {
          console.warn("Failed to delete Cloudinary image:", imageUrl, err);
        }
      }

      // Unlink from Admin
      await Admin.findByIdAndUpdate(client.author, {
        $pull: { userLinks: client._id },
      });

      // Delete client record
      await Client.findByIdAndDelete(id);

      req.flash(
        "success",
        "Client transaction, related images, and admin reference deleted successfully."
      );
      return res.redirect("/admin/dashboard");
    } catch (err) {
      console.error(err);
      req.flash("error", "Server error while deleting transaction.");
      return res.redirect("/admin/dashboard");
    }
  }
);

module.exports = router;
