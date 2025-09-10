const express = require("express");
const router = express.Router();
const Client = require("../../models/client");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const app = require("../..");
const cloudinary = require("cloudinary").v2;
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

    // Map of currency symbols to names
    const currencyNames = {
      $: "US Dollar", // NOTE: "$" also used by CAD, AUD, MXN (see below)
      "₦": "Nigerian Naira",
      "€": "Euro",
      "£": "British Pound",
      "¥": "Japanese Yen",
      "₹": "Indian Rupee",
      CAD: "Canadian Dollar", // handle same $ symbol uniquely by value
      AUD: "Australian Dollar",
      MXN: "Mexican Peso",
      R: "South African Rand",
      KSh: "Kenyan Shilling",
      "₵": "Ghanaian Cedi",
      "﷼": "Saudi Riyal",
      R$: "Brazilian Real",
      "₽": "Russian Ruble",
      Fr: "Swiss Franc",
      "₨": "Pakistani Rupee",
      "৳": "Bangladeshi Taka",
      Rp: "Indonesian Rupiah",
      "₱": "Philippine Peso",
      "د.إ": "UAE Dirham",
      // add more as needed
    };

    const amountNumber = Number(payment.amount);

    // Convert amount number into words
    let amountInWords = numberToWords
      .toWords(amountNumber)
      .replace(/\b\w/g, (c) => c.toUpperCase());

    // Get the currency name based on the symbol
    const currencyName = currencyNames[payment.currency] || payment.currency;

    amountInWords = `${amountInWords} ${currencyName} Only`;

    if (!payment) {
      req.flash("error_msg", "Payment link not found");
      return res.redirect("/error");
    }

    res.render("user/payments", { payment, amountInWords });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Something went wrong. Please try again.");
    res.redirect("/error");
  }
});

router.post("/:txsId", async (req, res, next) => {
  try {
    const txsId = req.body.txsId;
    const getLink = await Client.findOne({ transactionId: txsId });

    if (!getLink) {
      req.flash(
        "error",
        "Payment for this ID could not be found. Please verify the ID."
      );
      return res.redirect("/home"); // <- return here to stop execution
    }

    res.redirect(getLink.link);
  } catch (err) {
    console.error(err); // log error for debugging
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
router.get("/update-transaction/:id", async (req, res) => {
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

module.exports = router;
