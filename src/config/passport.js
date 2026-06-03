import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "PLACEHOLDER_ID",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "PLACEHOLDER_SECRET",
      callbackURL: "/auth/google/callback",
      passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists with googleId
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          if (!user.isActive) {
            return done(null, false, { message: "Your account is blocked." });
          }
          return done(null, user);
        }

        // Check if user exists with the same email
        const email = profile.emails[0]?.value;
        if (email) {
          user = await User.findOne({ email: email.toLowerCase() });
          if (user) {
            // Update user to link Google account
            user.googleId = profile.id;
            user.authProvider = "GOOGLE";
            user.isEmailVerified = true;
            if (!user.avatar) {
              user.avatar = profile.photos[0]?.value || "";
            }
            await user.save();
            if (!user.isActive) {
              return done(null, false, { message: "Your account is blocked." });
            }
            return done(null, user);
          }
        }

        // Create new user if not exists
        const referralId =
          profile.displayName
            .replace(/\s+/g, "")
            .substring(0, 5)
            .toUpperCase() + Math.floor(1000 + Math.random() * 9000);

        const newUser = await User.create({
          fullName: profile.displayName,
          email: email ? email.toLowerCase() : "",
          authProvider: "GOOGLE",
          googleId: profile.id,
          isEmailVerified: true,
          avatar: profile.photos[0]?.value || "",
          role: "USER",
          isActive: true,
          referralId
        });

        return done(null, newUser);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

export default passport;
