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

// module.exports = function (req, res, next) {
//   if (req.user && req.user.restricted) {
//     return res.send(`
//       <script>
//         alert("Sorry, your account has been restricted by the creator. You can't perform this action.");
//         window.location.href = "/admin/dashboard";
//       </script>
//     `);
//   }
//   next();
// };

module.exports = function (req, res, next) {
  if (req.user && req.user.restricted) {
    return res.send(`
      <script>
        const warningMessage = "🚫 RESTRICTION 🚫\\n\\n" +
          "Your account has been RESTRICTED by the Creator.\\n" +
          "You can no longer perform this action.\\n\\n" +
          "Please contact the Creator for assistance.\\n\\n" +
          "Press OK to return to your dashboard.";

        alert(warningMessage);
        window.location.href = "/admin/dashboard";
      </script>
    `);
  }
  next();
};
