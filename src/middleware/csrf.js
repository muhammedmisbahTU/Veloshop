import crypto from "crypto";

export const csrfToken = (req, res, next) => {
    if (!req.session) {
        return next();
    }

    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    }

    res.locals.csrfToken = req.session.csrfToken;

    res.cookie("XSRF-TOKEN", req.session.csrfToken, {
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
    });

    next();
};

export const validateCsrf = (req, res, next) => {
    const safeMethods = ["GET", "HEAD", "OPTIONS"];

    if (safeMethods.includes(req.method)) {
        return next();
    }

    const clientToken =
        req.headers["x-csrf-token"] ||
        req.headers["x-xsrf-token"] ||
        req.body?.csrfToken ||
        req.query?.csrfToken;

    if (!clientToken || clientToken !== req.session?.csrfToken) {
        return res.status(403).json({
            success: false,
            message: "CSRF token validation failed. Please refresh the page and try again."
        });
    }

    next();
};