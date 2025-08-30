const express = require("express");
const router = express.Router();
const wrapAssync = require("../../utils/wrapAsync");
const Client = require("../../models/client"); // <-- your UserLink model

router.get(
  "/:linkTxt/payments/payment-method",
  wrapAssync(async (req, res) => {
    const { linkTxt } = req.params;

    const userLink = await Client.findOne({
      link: `/user/${linkTxt}/payments`,
    }).populate("author");

    console.log(userLink);

    res.render("user/payment-method", {
      client: userLink,
    });
  })
);

router.get("/:linkTxt/payments", async (req, res) => {
  try {
    const { linkTxt } = req.params;

    // Find the payment record by matching the link field
    const linkPath = `/user/${linkTxt}/payments`;
    const payment = await Client.findOne({ link: linkPath });

    if (!payment) {
      return res.status(404).render("error/errorPage", {
        err: "Payment link not found",
      });
    }

    console.log(payment);

    // Render a view with the payment details
    res.render("user/payments", { payment });
  } catch (err) {
    console.error(err);
    res.status(500).render("error/errorPage", { err });
  }
});

module.exports = router;
