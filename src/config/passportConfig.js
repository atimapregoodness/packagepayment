const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const User = require("../models/admin");

// Configure passport-local to use "email" instead of "username"
passport.use(
  new LocalStrategy(
    { usernameField: "email" }, // only accept email
    async (email, password, done) => {
      try {
        // Find user by email only
        const user = await User.findOne({ email });

        if (!user) {
          return done(null, false, { message: "Invalid email" });
        }

        // Authenticate password with passport-local-mongoose helper
        const isValid = await user.authenticate(password);
        if (!isValid) {
          return done(null, false, { message: "Incorrect password" });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// Required for sessions
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

module.exports = passport;
