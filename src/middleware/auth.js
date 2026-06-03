export const isAuthenticated = (req, res, next) => {
  const currentUser = req.user || req.session.user;
  if (!currentUser) {
    req.session.errorMessage = "Please log in to access this page.";
    return res.redirect("/login");
  }

  // If the user's email is not verified, they must verify it first
  if (!currentUser.isEmailVerified) {
    return res.redirect(`/verify-otp?email=${encodeURIComponent(currentUser.email)}`);
  }

  // If the user is blocked, log them out immediately
  if (!currentUser.isActive) {
    req.session.errorMessage = "Your account is blocked.";
    if (req.logout) {
      req.logout((err) => {
        delete req.session.user;
        return res.redirect("/login");
      });
    } else {
      delete req.session.user;
      return res.redirect("/login");
    }
    return;
  }

  next();
};

export const isAdmin = (req, res, next) => {
  const currentUser = req.user || req.session.user;
  if (!currentUser) {
    req.session.errorMessage = "Please log in as Admin.";
    return res.redirect("/login");
  }

  if (currentUser.role !== "ADMIN") {
    req.session.errorMessage = "Unauthorized access.";
    return res.redirect("/");
  }

  next();
};

export const isGuest = (req, res, next) => {
  const currentUser = req.user || req.session.user;
  if (currentUser) {
    // If they are logged in, redirect away from guest-only pages (like login/register)
    if (currentUser.role === "ADMIN") {
      return res.redirect("/admin/users"); // Default admin land page
    }
    return res.redirect("/");
  }
  next();
};
