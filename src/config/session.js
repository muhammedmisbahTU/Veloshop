import session from "express-session";
import dotenv from 'dotenv';
import MongoStore from 'connect-mongo';

dotenv.config();

if (process.env.NODE_ENV === "production" && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === "mySuperSecret")) {
  throw new Error("SESSION_SECRET must be set to a secure secret in production!");
}

const sessionConfig = session({
  secret: process.env.SESSION_SECRET || "mySuperSecret",

  resave: false,

  saveUninitialized: false,

  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60 // 1 day
  }),

  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax"
  }
});

export default sessionConfig;