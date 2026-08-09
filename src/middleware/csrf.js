import crypto from "crypto";

export const csrfProtection = (req, res, next) => {
  if (!req.session) {
    return next();
  }

  // Generate token if not already present in the session
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }

  // Expose token to EJS templates
  res.locals.csrfToken = req.session.csrfToken;

  // Set non-httpOnly cookie so client-side JavaScript can read it if needed
  res.cookie("XSRF-TOKEN", req.session.csrfToken, {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  // Bypass validation for safe HTTP methods
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Retrieve token from request body, query parameter, or headers
  const clientToken =
    req.body?.csrfToken ||
    req.query?.csrfToken ||
    req.headers["x-csrf-token"] ||
    req.headers["x-xsrf-token"];

  if (!clientToken || clientToken !== req.session.csrfToken) {
    return res.status(403).json({
      success: false,
      message: "CSRF token validation failed. Please refresh the page and try again."
    });
  }

  next();
};
