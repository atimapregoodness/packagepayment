module.exports = function isCreatorOrAdmin(req, res, next) {
  if (req.isAuthenticated()) {
    if (req.user.isCreator || req.user.isAdmin) {
      return next();
    }
  }
  req.flash("error", "Not authorized");
  return res.redirect("/login");
};
