const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");
require("dotenv").config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const name = profile.displayName;
        const googleId = profile.id;

        // Only allow vvce or gmail accounts
        if (!email.endsWith("@vvce.ac.in") && !email.endsWith("@gmail.com")) {
          return done(null, false, {
            message: "Only @vvce.ac.in (vvce) or @gmail.com accounts are allowed for testing",
          });
        }

        // ✅ FIXED ORIGINAL ROLE LOGIC
        // vvce → student
        // gmail → admin
        const role = email.endsWith("@vvce.ac.in") ? "student" : "admin";

        // Find user by email (ensures each unique email gets its own record)
        let user = await User.findOne({ email });

        if (!user) {
          // create a new user document for this email
          user = new User({
            name,
            email,
            password: "google-oauth",
            role,
            googleId,
          });
          await user.save();
          console.log(`🆕 Created (test role) ${role}: ${email}`);
        } else {
          // update googleId if missing and correct role if needed
          let changed = false;
          if (!user.googleId) {
            user.googleId = googleId;
            changed = true;
          }
          if (user.role !== role) {
            user.role = role;
            changed = true;
          }
          if (changed) {
            await user.save();
            console.log(`🔁 Updated (test role) ${email} → role: ${role}`);
          }
        }

        return done(null, user);
      } catch (err) {
        console.error("❌ Passport error:", err);
        return done(err, null);
      }
    }
  )
);

// Serialize / Deserialize
passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
