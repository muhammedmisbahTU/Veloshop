import bcrypt from "bcrypt";
import User from "../models/User.js";

const PAGE_SIZE = 5;

const toSessionUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  isEmailVerified: user.isEmailVerified,
  isActive: user.isActive
});

const getSessionUserId = (session) => {
  if (session?.user?.id) {
    return session.user.id.toString();
  }

  if (session?.passport?.user) {
    return session.passport.user.toString();
  }

  return null;
};

const invalidateUserSessions = (req, userId) => {
  const sessionStore = req.sessionStore;
  const targetUserId = userId.toString();

  if (!sessionStore?.all || !sessionStore?.destroy) {
    return Promise.resolve(0);
  }

  return new Promise((resolve) => {
    sessionStore.all((error, sessions) => {
      if (error || !sessions) {
        return resolve(0);
      }

      const sessionEntries = Array.isArray(sessions)
        ? sessions.map((session, index) => [session.id || index, session])
        : Object.entries(sessions);

      const targetSessions = sessionEntries.filter(([, session]) => {
        return getSessionUserId(session) === targetUserId;
      });

      if (!targetSessions.length) {
        return resolve(0);
      }

      let finished = 0;
      let destroyed = 0;

      targetSessions.forEach(([sessionId]) => {
        sessionStore.destroy(sessionId, (destroyError) => {
          finished += 1;
          if (!destroyError) {
            destroyed += 1;
          }

          if (finished === targetSessions.length) {
            resolve(destroyed);
          }
        });
      });
    });
  });
};

export const getAdminLogin = (req, res) => {
  const currentUser = req.user || req.session.user;

  if (currentUser?.role === "ADMIN") {
    return res.redirect("/admin/users");
  }

  res.render("admin/login", {
    layout: "layouts/auth-layout",
    title: "Admin Login - Veloshop"
  });
};

export const postAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase(), role: "ADMIN" });
    if (!user || user.authProvider !== "LOCAL") {
      return res.status(400).json({
        success: false,
        message: "Invalid admin credentials."
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin credentials."
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "This admin account is blocked."
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify this account before admin login."
      });
    }

    req.session.user = toSessionUser(user);

    return res.status(200).json({
      success: true,
      message: "Admin login successful."
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong during admin login."
    });
  }
};

export const getUsers = async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const requestedOrder = req.query.sort || "desc";
    const order = requestedOrder === "asc" ? "asc" : "desc";
    const sortBy = req.query.sortBy || "createdAt";
    const filterStatus = req.query.status || "all";
    const filterRole = req.query.role || "all";
    const filterProvider = req.query.provider || "all";
    const startDate = req.query.startDate || ""
    const endDate = req.query.endDate || ""

    const query = {};

    // Text search
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }
    
    // Status filter
    if (filterStatus === "active") {
      query.isActive = true;
    } else if (filterStatus === "blocked") {
      query.isActive = false;
    }

    // Role filter
    if (filterRole === "user") {
      query.role = "USER";
    } else if (filterRole === "admin") {
      query.role = "ADMIN";
    }

    // Provider filter
    if (filterProvider === "local") {
      query.authProvider = "LOCAL";
    } else if (filterProvider === "google") {
      query.authProvider = "GOOGLE";
    }

    // Sort direction
    const sortDirection = order === "asc" ? 1 : -1;

    // Sort field (whitelist allowed fields)
    const allowedSortFields = ["createdAt", "fullName", "email", "role", "authProvider", "isActive"];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    
    // Date filter
    if(startDate||endDate){
      query.createdAt={}

      if(startDate){
        query.createdAt.$gte = new Date(startDate + 'T00:00:00.000Z')
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate + "T23:59:59.999Z");
      }
    }

    const [users, totalUsers] = await Promise.all([
      User.find(query)
        .sort({ [safeSortBy]: sortDirection })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE),
      User.countDocuments(query)
    ]);

    const totalPages = Math.max(Math.ceil(totalUsers / PAGE_SIZE), 1);

    res.render("admin/users", {
      layout: "layouts/admin-layout",
      title: "User Management - Veloshop",
      users,
      search,
      sort: order,
      sortBy: safeSortBy,
      filterStatus,
      filterRole,
      filterProvider,
      page,
      totalPages,
      totalUsers,
      startDate,
      endDate,
    });
  } catch (error) {
    console.error("Admin user list error:", error);
    req.session.errorMessage = "Failed to load users.";
    res.redirect("/");
  }
};

export const blockUser = async (req, res) => {
  try {
    const currentUser = req.user || req.session.user;
    const { id } = req.params;

    if ((currentUser.id || currentUser._id).toString() === id) {
      return res.status(400).json({
        success: false,
        message: "You cannot block your own admin account."
      });
    }

    const user = await User.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const destroyedSessions = await invalidateUserSessions(req, user._id);

    return res.status(200).json({
      success: true,
      message: `${user.fullName} has been blocked.`,
      destroyedSessions
    });
  } catch (error) {
    console.error("Block user error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to block user."
    });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(id, { isActive: true }, { new: true });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    return res.status(200).json({
      success: true,
      message: `${user.fullName} has been unblocked.`
    });
  } catch (error) {
    console.error("Unblock user error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to unblock user."
    });
  }
};
