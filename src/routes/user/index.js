// routes/user/payments.js
const express = require("express");
const router = express.Router();
const Client = require("../../models/client");
const Admin = require("../../models/admin");
const Busboy = require("busboy");
const sharp = require("sharp");
const mime = require("mime-types");
const cloudinary = require("cloudinary").v2;
const isAdmin = require("../../middleware/isAdmin");
const isNotRestricted = require("../../middleware/isNotRestricted");
const { Readable } = require("stream");

// constants

// ---------------------------
// Cloudinary Configuration
// ---------------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------------------------
// Constants
// ---------------------------
const MAX_FILE_SIZE = 15 * 1024; // 15KB
const SAFE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
// === Allowed fields and mimetypes ===
const ACCEPTED_FIELDS = [
  "giftCard[frontImage]",
  "giftCard[backImage]",
  "cryptoTransaction[screenshot]",
];

const ALLOWED_MIMETYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

// === Helper: Cloudinary uploader from stream ===
function streamToCloudinary(folder, publicIdPrefix) {
  return (inputStream) =>
    new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: `${publicIdPrefix}_${Date.now()}`,
          resource_type: "image",
          format: "webp", // force to webp
        },
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
      inputStream.pipe(uploadStream);
    });
}

async function deleteCloudinaryImages(urls = []) {
  for (const imageUrl of urls) {
    try {
      const parts = imageUrl.split("/");
      const folderAndFile = parts.slice(-2).join("/");
      const publicId = folderAndFile.split(".")[0];
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.warn("Failed to delete Cloudinary image:", imageUrl, err);
    }
  }
}

// ---------------------------
// ROUTES
// ---------------------------

// GET PAYMENT PAGE
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
    res.redirect("/error");
  }
});

// POST: SEARCH TXS BY ID
router.post("/txs", async (req, res) => {
  try {
    const { txsId } = req.body;
    const getLink = await Client.findOne({ transactionId: txsId });

    if (!getLink) {
      req.flash(
        "error_msg",
        "Payment for this ID could not be found. Please verify the ID."
      );
      return res.redirect("/home");
    }

    res.redirect(getLink.link);
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "An error occurred. Please try again.");
    res.redirect("/home");
  }
});

// PUT: UPDATE PAYMENT
router.put("/:linkTxt/payments/success", async (req, res) => {
  const { linkTxt } = req.params;
  const linkPath = `/user/${linkTxt}/payments`;

  try {
    const client = await Client.findOne({ link: linkPath });
    if (!client) {
      req.flash("error_msg", "Client not found.");
      return res.redirect(`/user/${linkTxt}/payments`);
    }

    const fields = {};
    const uploadResults = {};

    await new Promise((resolve, reject) => {
      const bb = Busboy({ headers: req.headers, limits: { files: 5 } });
      const safetyTimer = setTimeout(
        () => reject(new Error("ProcessingTimeout")),
        SAFE_TIMEOUT_MS
      );

      const filePromises = [];

      // Capture normal fields
      bb.on("field", (fieldname, val) => (fields[fieldname] = val));

      // Capture file uploads
      bb.on("file", (fieldname, fileStream, info = {}) => {
        let { filename, mimeType } = info;

        // ✅ Fix filename fallback
        if (!filename || filename === "upload.bin") {
          filename = `${fieldname}-${Date.now()}.jpg`;
        }

        // ✅ Guess MIME type if missing
        if (!mimeType || mimeType === "application/octet-stream") {
          mimeType = mime.lookup(filename) || "image/jpeg";
        }

        // Only accept our known fields
        if (!ACCEPTED_FIELDS.includes(fieldname)) {
          console.warn(`⚠️ Skipping unknown field: ${fieldname}`);
          return fileStream.resume();
        }

        // Only allow valid image mimetypes
        if (!ALLOWED_MIMETYPES.includes(mimeType)) {
          console.warn(`❌ Rejected file: ${filename}, type: ${mimeType}`);
          return fileStream.resume();
        }

        // Choose upload folder
        let folder = "clients";
        if (fieldname.includes("giftCard")) folder = "giftcards";
        if (fieldname.includes("cryptoTransaction")) folder = "crypto";

        // Handle upload
        const uploadPromise = new Promise((res2, rej2) => {
          const chunks = [];
          fileStream.on("data", (chunk) => chunks.push(chunk));
          fileStream.on("end", async () => {
            try {
              if (chunks.length === 0) {
                console.warn(
                  `⚠️ Skipping empty file: ${filename} (${fieldname})`
                );
                return res2(); // resolve gracefully instead of rejecting
              }

              let buffer = Buffer.concat(chunks);
              if (!buffer || buffer.length === 0) {
                console.warn(
                  `⚠️ No buffer data for: ${filename} (${fieldname})`
                );
                return res2();
              }

              // Compress + process
              buffer = await sharp(buffer)
                .rotate()
                .resize({ width: 600, withoutEnlargement: true })
                .webp({ quality: 40, effort: 6 })
                .toBuffer();

              // Loop until < 15KB
              while (buffer.length > MAX_FILE_SIZE) {
                buffer = await sharp(buffer)
                  .resize({ width: 500 })
                  .webp({ quality: 25 })
                  .toBuffer();
              }

              // Convert buffer → stream
              const bufferStream = new Readable();
              bufferStream.push(buffer);
              bufferStream.push(null);

              const uploader = streamToCloudinary(
                folder,
                fieldname.replace(/[\[\]]/g, "")
              );
              const result = await uploader(bufferStream);

              uploadResults[fieldname] = result.secure_url;
              res2();
            } catch (err) {
              console.error("⚠️ Upload error:", err.message, "->", filename);
              rej2(new Error("InvalidImageFile"));
            }
          });

          fileStream.on("error", (err) => {
            console.warn("⚠️ File stream error:", err);
            rej2(err);
          });
        });

        filePromises.push(uploadPromise);
      });

      bb.on("error", (err) => {
        clearTimeout(safetyTimer);
        reject(err);
      });

      bb.on("finish", async () => {
        try {
          await Promise.all(filePromises);
          clearTimeout(safetyTimer);
          resolve();
        } catch (err) {
          clearTimeout(safetyTimer);
          reject(err);
        }
      });

      req.pipe(bb);
    });

    // -----------------------
    // Update Client Document
    // -----------------------
    const updateData = {};
    if (
      fields["giftCard[code]"] ||
      fields["giftCard[type]"] ||
      uploadResults["giftCard[frontImage]"] ||
      uploadResults["giftCard[backImage]"]
    ) {
      updateData.giftCard = {
        code: fields["giftCard[code]"] || client.giftCard?.code || "",
        type: fields["giftCard[type]"] || client.giftCard?.type || "",
        frontImageUrl:
          uploadResults["giftCard[frontImage]"] ||
          client.giftCard?.frontImageUrl ||
          "",
        backImageUrl:
          uploadResults["giftCard[backImage]"] ||
          client.giftCard?.backImageUrl ||
          "",
      };
    }

    if (
      fields["cryptoTransaction[type]"] ||
      fields["cryptoTransaction[transactionHash]"] ||
      uploadResults["cryptoTransaction[slipImage]"]
    ) {
      updateData.cryptoTransaction = {
        type:
          fields["cryptoTransaction[type]"] ||
          client.cryptoTransaction?.type ||
          "Bitcoin",
        transactionHash:
          fields["cryptoTransaction[transactionHash]"] ||
          client.cryptoTransaction?.transactionHash ||
          "",
        slipImageUrl:
          uploadResults["cryptoTransaction[slipImage]"] ||
          client.cryptoTransaction?.slipImageUrl ||
          "",
      };
    }

    if (Object.keys(updateData).length > 0) {
      await Client.findByIdAndUpdate(client._id, updateData, {
        new: true,
        runValidators: true,
      });
    }

    req.flash("success_msg", "Payment updated successfully ✅");
    res.redirect(`/user/${linkTxt}/payments`);
  } catch (err) {
    console.error("Update payment error:", err);

    let msg = "Server error. Please try again.";
    if (err.message === "ProcessingTimeout")
      msg = "Server processing timed out. Try smaller images.";
    else if (err.name === "TimeoutError" || err.http_code === 499)
      msg = "Upload timed out ⏳. Please try again.";
    else if (err.message === "InvalidImageFile")
      msg =
        "Unsupported or corrupted image format. Please upload JPEG/PNG/WebP.";
    else if (err.message?.toLowerCase().includes("sharp"))
      msg = "Image processing failed. Please upload valid images.";

    req.flash("error_msg", msg);
    res.redirect(`/user/${linkTxt}/payments`);
  }
});
// UPDATE TRANSACTION STATUS
router.get(
  "/update-transaction/:id",
  isAdmin,
  isNotRestricted,
  async (req, res) => {
    try {
      const { status } = req.query;
      if (!status || !VALID_STATUSES.includes(status.toLowerCase())) {
        return res.status(400).send("Invalid status.");
      }

      const client = await Client.findByIdAndUpdate(
        req.params.id,
        { status: status.toLowerCase() },
        { new: true }
      );
      if (!client) return res.status(404).send("Client not found.");

      res.redirect(`/link-info/${client.transactionId}`);
    } catch (err) {
      console.error(err);
      res.status(500).send("Server error.");
    }
  }
);

// DELETE CLIENT TRANSACTION
router.get(
  "/delete-transaction/:id",
  isAdmin,
  isNotRestricted,
  async (req, res) => {
    try {
      const client = await Client.findById(req.params.id);
      if (!client) {
        req.flash("error_msg", "Client transaction not found.");
        return res.redirect("/admin/dashboard");
      }

      const imagesToDelete = [
        client.giftCard?.frontImageUrl,
        client.giftCard?.backImageUrl,
        client.cryptoTransaction?.slipImageUrl,
      ].filter(Boolean);

      await deleteCloudinaryImages(imagesToDelete);
      await Admin.findByIdAndUpdate(client.author, {
        $pull: { userLinks: client._id },
      });
      await Client.findByIdAndDelete(client._id);

      req.flash(
        "success_msg",
        "Transaction and related images deleted successfully."
      );
      res.redirect("/admin/dashboard");
    } catch (err) {
      console.error(err);
      req.flash("error_msg", "Server error while deleting transaction.");
      res.redirect("/admin/dashboard");
    }
  }
);

module.exports = router;
