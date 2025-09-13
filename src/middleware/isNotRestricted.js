module.exports = function (req, res, next) {
  if (req.user && req.user.restricted) {
    req.flash(
      "error",
      "Sorry your account has been restricted by the creator, you can't perform this action"
    );
    return res.redirect("/admin/dashboard");
  }
  next();
};
