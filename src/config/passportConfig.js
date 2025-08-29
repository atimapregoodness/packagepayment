const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/admin');

passport.use(
  new LocalStrategy(
    { usernameField: 'identifier' }, // Change to 'identifier' to support both email and username
    async (identifier, password, done) => {
      try {
        // Find user by email or username
        const user = await User.findOne({
          $or: [{ username: identifier }, { email: identifier }],
        });

        if (!user) {
          return done(null, false, { message: 'Invalid username or email' });
        }

        // Verify password
        const isValid = await user.authenticate(password);
        if (!isValid) {
          return done(null, false, { message: 'Incorrect password' });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

module.exports = passport;
