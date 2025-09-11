const express = require("express");
const router = express.Router();
const Client = require("../../models/client");
const Admin = require("../../models/client");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const app = require("../..");
const cloudinary = require("cloudinary").v2;
const isAdmin = require("../../middleware/isAdmin");

const numberToWords = require("number-to-words");

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
      req.flash("error_msg", "Payment link not found");
      return res.redirect("/error");
    }

    res.render("user/payments", { payment });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Something went wrong. Please try again.");
    res.redirect("/error");
  }
});

router.post("/txs", async (req, res, next) => {
  console.log(req.params);
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

    res.redirect(`${getLink.link}`);
  } catch (err) {
    console.error(err);
    req.flash(
      "error",
      "An error occurred while processing your request. Please try again."
    );
    res.redirect("/home");
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

      // ---------------------------
      // Gift Card Update
      // ---------------------------
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

      // ---------------------------
      // Crypto Transaction Update
      // ---------------------------
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

      // ---------------------------
      // Update Client Record
      // ---------------------------
      await Client.findByIdAndUpdate(client._id, updateData, {
        new: true,
        runValidators: true,
      });

      req.flash("success_msg", "Payment updated successfully ✅");
      res.redirect(`/user/${linkTxt}/payments`);
    } catch (err) {
      console.error("Update payment error:", err);
      req.flash("error_msg", "Server error. Please try again.");
      res.redirect("back");
    }
  }
);

// Update transaction status
router.get("/update-transaction/:id", isAdmin, async (req, res) => {
  try {
    const { status } = req.query; // get status from query string
    const validStatuses = ["successful", "declined"];

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

    // Redirect to a specific page after update
    res.redirect(`/link-info/${client.transactionId}`); // replace with your admin links page
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error.");
  }
});

// Delete Client Transaction + Cloudinary files + unlink from Admin
router.get("/delete-transaction/:id", isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findById(id);

    if (!client) {
      req.flash("error", "Client transaction not found.");
      return res.redirect("/admin/dashboard");
    }

    // Collect all Cloudinary images (if any exist)
    const imagesToDelete = [];

    if (client.giftCard?.frontImageUrl)
      imagesToDelete.push(client.giftCard.frontImageUrl);
    if (client.giftCard?.backImageUrl)
      imagesToDelete.push(client.giftCard.backImageUrl);
    if (client.cryptoTransaction?.slipImageUrl)
      imagesToDelete.push(client.cryptoTransaction.slipImageUrl);

    // Delete each image from Cloudinary
    for (const imageUrl of imagesToDelete) {
      try {
        const publicId = imageUrl.split("/").slice(-1)[0].split(".")[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.warn("Failed to delete Cloudinary image:", imageUrl, err);
      }
    }

    // Remove this client ID from the Admin's userLinks
    await Admin.findByIdAndUpdate(client.author, {
      $pull: { userLinks: client._id },
    });

    // Now delete the client document
    await Client.findByIdAndDelete(id);

    req.flash(
      "success",
      "Client transaction, related images, and admin reference deleted successfully."
    );
    res.redirect("/admin/dashboard");
  } catch (err) {
    console.error(err);
    req.flash("error", "Server error while deleting transaction.");
    res.redirect("/admin/dashboard");
  }
});

module.exports = router;
