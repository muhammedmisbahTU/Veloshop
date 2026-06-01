import session from "express-session";

const sessionConfig = session({
  secret: process.env.SESSION_SECRET,

  resave: false,

  saveUninitialized: false,

  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    httpOnly: true,
    secure: false
  }
});

export default sessionConfig;