// module.exports = function (req, res, next) {
//   if (req.user && req.user.restricted) {
//     req.flash(
//       "error",
//       "Sorry your account has been restricted by the creator, you can't perform this action"
//     );
//     return res.redirect("/admin/dashboard");
//   }
//   next();
// };

module.exports = function (req, res, next) {
  if (req.user && req.user.restricted) {
    return res.send(`
      <script>
        alert("Sorry, your account has been restricted by the creator. You can't perform this action.");
        window.location.href = "/admin/dashboard";
      </script>
    `);
  }
  next();
};
