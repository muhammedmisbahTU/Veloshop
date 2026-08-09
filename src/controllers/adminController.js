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
    const search = String(req.query.search || "").trim();
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

export const getDashboard = async (req, res) => {
  try {
    const Order = (await import("../models/Order.js")).default;
    const User = (await import("../models/User.js")).default;

    const filter = req.query.filter || "weekly"; // weekly, monthly, yearly, custom
    const startDateStr = req.query.startDate || "";
    const endDateStr = req.query.endDate || "";

    const totalOrders = await Order.countDocuments();
    const totalCustomers = await User.countDocuments({ role: "USER" });
    const totalSales = await Order.countDocuments({ paymentStatus: "SUCCESS" });

    const revenueAgg = await Order.aggregate([
      { $match: { paymentStatus: "SUCCESS" } },
      { $group: { _id: null, total: { $sum: "$grandTotal" } } }
    ]);
    const totalRevenue = revenueAgg[0]?.total || 0;

    const pendingOrders = await Order.countDocuments({ status: "PENDING" });
    const cancelledOrders = await Order.countDocuments({ status: "CANCELLED" });
    const returnedOrders = await Order.countDocuments({ status: "RETURNED" });

    // Build date ranges for filters
    const matchQuery = { paymentStatus: "SUCCESS" };
    const now = new Date();
    let groupFormat = "%Y-%m-%d"; // default daily format

    if (filter === "weekly") {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      matchQuery.createdAt = { $gte: oneWeekAgo };
      groupFormat = "%Y-%m-%d";
    } else if (filter === "monthly") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      matchQuery.createdAt = { $gte: startOfMonth };
      groupFormat = "%Y-%m-%d";
    } else if (filter === "yearly") {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      matchQuery.createdAt = { $gte: startOfYear };
      groupFormat = "%Y-%m"; // Group by Month
    } else if (filter === "custom") {
      matchQuery.createdAt = {};
      if (startDateStr) {
        matchQuery.createdAt.$gte = new Date(startDateStr + "T00:00:00.000Z");
      }
      if (endDateStr) {
        matchQuery.createdAt.$lte = new Date(endDateStr + "T23:59:59.999Z");
      }
      if (!startDateStr && !endDateStr) {
        delete matchQuery.createdAt;
      }
    }

    const salesOverTimeAgg = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: "$createdAt" } },
          totalSales: { $sum: "$grandTotal" },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const chartLabels = [];
    const salesTrends = [];
    const orderTrends = [];

    if (filter === "weekly") {
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateString = d.toISOString().split("T")[0];
        chartLabels.push(dateString);
        const found = salesOverTimeAgg.find(item => item._id === dateString);
        salesTrends.push(found ? found.totalSales : 0);
        orderTrends.push(found ? found.orderCount : 0);
      }
    } else if (filter === "monthly") {
      // Last 30 days
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateString = d.toISOString().split("T")[0];
        chartLabels.push(dateString);
        const found = salesOverTimeAgg.find(item => item._id === dateString);
        salesTrends.push(found ? found.totalSales : 0);
        orderTrends.push(found ? found.orderCount : 0);
      }
    } else if (filter === "yearly") {
      // 12 months
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      for (let i = 0; i < 12; i++) {
        const yearMonth = `${now.getFullYear()}-${String(i + 1).padStart(2, "0")}`;
        chartLabels.push(monthNames[i]);
        const found = salesOverTimeAgg.find(item => item._id === yearMonth);
        salesTrends.push(found ? found.totalSales : 0);
        orderTrends.push(found ? found.orderCount : 0);
      }
    } else {
      // Custom range listing
      salesOverTimeAgg.forEach(item => {
        chartLabels.push(item._id);
        salesTrends.push(item.totalSales);
        orderTrends.push(item.orderCount);
      });
    }

    // Aggregate top 10 best-selling products (completed / DELIVERED orders)
    const bestSellersAgg = await Order.aggregate([
      { $match: { status: "DELIVERED" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.variantId",
          productName: { $first: "$items.productName" },
          thumbnail: { $first: "$items.thumbnail" },
          sku: { $first: "$items.sku" },
          totalQuantity: { $sum: "$items.quantity" },
          totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 }
    ]);

    // Aggregate top 10 best-selling categories (completed / DELIVERED orders)
    const bestCategoriesAgg = await Order.aggregate([
      { $match: { status: "DELIVERED" } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "variants",
          localField: "items.variantId",
          foreignField: "_id",
          as: "variantInfo"
        }
      },
      { $unwind: "$variantInfo" },
      {
        $lookup: {
          from: "products",
          localField: "variantInfo.productId",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      { $unwind: "$productInfo" },
      {
        $lookup: {
          from: "categories",
          localField: "productInfo.categoryId",
          foreignField: "_id",
          as: "categoryInfo"
        }
      },
      { $unwind: "$categoryInfo" },
      {
        $group: {
          _id: "$categoryInfo._id",
          categoryName: { $first: "$categoryInfo.name" },
          totalQuantity: { $sum: "$items.quantity" },
          totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 }
    ]);

    // Aggregate top 10 best-selling brands (completed / DELIVERED orders)
    const bestBrandsAgg = await Order.aggregate([
      { $match: { status: "DELIVERED" } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "variants",
          localField: "items.variantId",
          foreignField: "_id",
          as: "variantInfo"
        }
      },
      { $unwind: "$variantInfo" },
      {
        $lookup: {
          from: "products",
          localField: "variantInfo.productId",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      { $unwind: "$productInfo" },
      {
        $group: {
          _id: "$productInfo.brand",
          brandName: { $first: "$productInfo.brand" },
          totalQuantity: { $sum: "$items.quantity" },
          totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 }
    ]);

    res.render("admin/dashboard", {
      layout: "layouts/admin-layout",
      title: "Control Center Dashboard",
      path: "/admin/dashboard",
      stats: {
        totalOrders,
        totalSales,
        totalRevenue,
        totalCustomers,
        pendingOrders,
        cancelledOrders,
        returnedOrders
      },
      filter,
      startDate: startDateStr,
      endDate: endDateStr,
      chartLabels: JSON.stringify(chartLabels),
      salesTrends: JSON.stringify(salesTrends),
      orderTrends: JSON.stringify(orderTrends),
      bestSellers: bestSellersAgg,
      bestCategories: bestCategoriesAgg,
      bestBrands: bestBrandsAgg
    });
  } catch (err) {
    console.error("Admin dashboard calculation failed:", err);
    req.session.errorMessage = "Failed to load dashboard statistics.";
    res.redirect("/admin/users");
  }
};

const compileSalesReportData = async (filter, startDateStr, endDateStr) => {
  const Order = (await import("../models/Order.js")).default;
  const matchQuery = {};

  const now = new Date();
  if (filter === "daily") {
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const endOfDay = new Date(now.setHours(23, 59, 59, 999));
    matchQuery.createdAt = { $gte: startOfDay, $lte: endOfDay };
  } else if (filter === "weekly") {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    matchQuery.createdAt = { $gte: oneWeekAgo };
  } else if (filter === "monthly") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    matchQuery.createdAt = { $gte: startOfMonth };
  } else if (filter === "yearly") {
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    matchQuery.createdAt = { $gte: startOfYear };
  } else if (filter === "custom") {
    matchQuery.createdAt = {};
    if (startDateStr) {
      matchQuery.createdAt.$gte = new Date(startDateStr + "T00:00:00.000Z");
    }
    if (endDateStr) {
      matchQuery.createdAt.$lte = new Date(endDateStr + "T23:59:59.999Z");
    }
    if (!startDateStr && !endDateStr) {
      delete matchQuery.createdAt;
    }
  }

  // Fetch orders matching the range
  const orders = await Order.find(matchQuery).sort({ createdAt: -1 });

  // Calculate totals
  let orderCount = orders.length;
  let totalSales = 0;
  let totalDiscounts = 0;
  let couponDeductions = 0;
  let finalAmount = 0;
  let cancelledAmount = 0;
  let returnedAmount = 0;

  orders.forEach(order => {
    // Sum coupon discount
    couponDeductions += order.couponDiscount || 0;
    // Sum total discounts (Coupon + Offer)
    totalDiscounts += (order.couponDiscount || 0) + (order.offerDiscount || 0);

    if (order.status === "CANCELLED") {
      cancelledAmount += order.grandTotal;
    } else if (order.status === "RETURNED") {
      returnedAmount += order.grandTotal;
    } else {
      // For CONFIRMED, PROCESSING, SHIPPED, DELIVERED
      if (order.paymentStatus === "SUCCESS") {
        totalSales += order.grandTotal;
      }
      finalAmount += order.grandTotal;
    }
  });

  return {
    orders,
    summary: {
      orderCount,
      totalSales,
      totalDiscounts,
      couponDeductions,
      finalAmount,
      cancelledAmount,
      returnedAmount
    }
  };
};

export const getSalesReports = async (req, res) => {
  try {
    const filter = req.query.filter || "daily";
    const startDate = req.query.startDate || "";
    const endDate = req.query.endDate || "";

    const { orders, summary } = await compileSalesReportData(filter, startDate, endDate);

    res.render("admin/reports", {
      layout: "layouts/admin-layout",
      title: "Sales Report Analytics",
      path: "/admin/reports",
      orders,
      summary,
      filter,
      startDate,
      endDate
    });
  } catch (error) {
    console.error("Get sales report error:", error);
    req.session.errorMessage = "Failed to load sales report.";
    res.redirect("/admin/dashboard");
  }
};

export const downloadSalesReport = async (req, res) => {
  try {
    const filter = req.query.filter || "daily";
    const startDate = req.query.startDate || "";
    const endDate = req.query.endDate || "";
    const format = req.query.format || "csv";

    const { orders, summary } = await compileSalesReportData(filter, startDate, endDate);

    if (format === "excel") {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Sales Report");

      worksheet.columns = [
        { header: "Order Number", key: "orderNumber", width: 25 },
        { header: "Date", key: "date", width: 15 },
        { header: "Payment Method", key: "paymentMethod", width: 15 },
        { header: "Payment Status", key: "paymentStatus", width: 15 },
        { header: "Order Status", key: "orderStatus", width: 15 },
        { header: "Grand Total (INR)", key: "grandTotal", width: 20 }
      ];

      orders.forEach(order => {
        worksheet.addRow({
          orderNumber: order.orderNumber,
          date: order.createdAt.toDateString(),
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          orderStatus: order.status,
          grandTotal: order.grandTotal
        });
      });

      // Add summary details at bottom of sheet
      worksheet.addRow([]);
      worksheet.addRow({ orderNumber: "Summary Statistics" });
      worksheet.addRow({ orderNumber: "Order Count", date: summary.orderCount });
      worksheet.addRow({ orderNumber: "Total Sales", date: summary.totalSales });
      worksheet.addRow({ orderNumber: "Discounts Applied", date: summary.totalDiscounts });
      worksheet.addRow({ orderNumber: "Coupon Deductions", date: summary.couponDeductions });
      worksheet.addRow({ orderNumber: "Final Net Amount", date: summary.finalAmount });
      worksheet.addRow({ orderNumber: "Cancelled Amount", date: summary.cancelledAmount });
      worksheet.addRow({ orderNumber: "Returned Amount", date: summary.returnedAmount });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=sales-report-${filter}-${Date.now()}.xlsx`);

      await workbook.xlsx.write(res);
      return res.end();
    } else if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=sales-report-${filter}-${Date.now()}.csv`);

      let csvContent = "Sales Report Summary\n";
      csvContent += `Order Count,${summary.orderCount}\n`;
      csvContent += `Total Sales,INR ${summary.totalSales.toFixed(2)}\n`;
      csvContent += `Discounts,INR ${summary.totalDiscounts.toFixed(2)}\n`;
      csvContent += `Coupon Deductions,INR ${summary.couponDeductions.toFixed(2)}\n`;
      csvContent += `Final Revenue Amount,INR ${summary.finalAmount.toFixed(2)}\n`;
      csvContent += `Cancelled Amount,INR ${summary.cancelledAmount.toFixed(2)}\n`;
      csvContent += `Returned Amount,INR ${summary.returnedAmount.toFixed(2)}\n\n`;

      csvContent += "Order Number,Date,Payment Method,Payment Status,Order Status,Grand Total\n";
      orders.forEach(order => {
        csvContent += `${order.orderNumber},${order.createdAt.toDateString()},${order.paymentMethod},${order.paymentStatus},${order.status},${order.grandTotal}\n`;
      });

      return res.status(200).send(csvContent);
    } else {
      // PDF download using PDFKit
      const PDFDocument = (await import("pdfkit")).default;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=sales-report-${filter}-${Date.now()}.pdf`);

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      doc.pipe(res);

      const brandColor = "#84CC16"; // Lime/Green brand accent
      const darkSlate = "#0F172A"; // Dark body text
      const lightSlate = "#475569"; // Secondary gray text
      const tableHeaderBg = "#F1F5F9"; // Cool gray headers
      const borderBg = "#E2E8F0"; // Subtle border lines

      // 1. Accent Banner
      doc.rect(0, 0, doc.page.width, 12).fill(brandColor);

      // 2. Title Header
      doc.fillColor(darkSlate).font("Helvetica-Bold").fontSize(20).text("VELOSHOP SALES REPORT", 50, 40);
      
      let dateRangeStr = `Filter: ${filter.toUpperCase()}`;
      if (filter === "custom") {
        dateRangeStr += ` (${startDate} to ${endDate})`;
      }
      doc.fillColor(lightSlate).font("Helvetica").fontSize(9).text(dateRangeStr, 50, 62);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 50, 74);
      
      doc.strokeColor(borderBg).lineWidth(1).moveTo(50, 95).lineTo(doc.page.width - 50, 95).stroke();

      // 3. Analytics Summary (Two-column dashboard layout)
      doc.fillColor(darkSlate).font("Helvetica-Bold").fontSize(13).text("Summary Analytics", 50, 110);
      
      const metricStartY = 130;
      const metricRowHeight = 16;
      
      const leftColX = 50;
      const leftColValueX = 180;
      const rightColX = doc.page.width / 2 + 10;
      const rightColValueX = rightColX + 140;

      const leftMetrics = [
        { label: "Total Orders Count:", val: `${summary.orderCount}` },
        { label: "Total Sales Value (Paid):", val: `INR ${Number(summary.totalSales || 0).toFixed(2)}` },
        { label: "Final Net Revenue:", val: `INR ${Number(summary.finalAmount || 0).toFixed(2)}` },
      ];

      const rightMetrics = [
        { label: "Total Discounts Applied:", val: `INR ${Number(summary.totalDiscounts || 0).toFixed(2)}` },
        { label: "Coupon Deductions:", val: `INR ${Number(summary.couponDeductions || 0).toFixed(2)}` },
        { label: "Cancelled Revenue Loss:", val: `INR ${Number(summary.cancelledAmount || 0).toFixed(2)}` },
        { label: "Returned Revenue Loss:", val: `INR ${Number(summary.returnedAmount || 0).toFixed(2)}` },
      ];

      // Render Left Metrics
      leftMetrics.forEach((m, idx) => {
        const y = metricStartY + (idx * metricRowHeight);
        doc.fillColor(lightSlate).font("Helvetica-Bold").fontSize(9).text(m.label, leftColX, y);
        doc.fillColor(darkSlate).font("Helvetica").fontSize(9).text(m.val, leftColValueX, y);
      });

      // Render Right Metrics
      rightMetrics.forEach((m, idx) => {
        const y = metricStartY + (idx * metricRowHeight);
        doc.fillColor(lightSlate).font("Helvetica-Bold").fontSize(9).text(m.label, rightColX, y);
        doc.fillColor(darkSlate).font("Helvetica").fontSize(9).text(m.val, rightColValueX, y);
      });

      doc.strokeColor(borderBg).lineWidth(1).moveTo(50, 205).lineTo(doc.page.width - 50, 205).stroke();

      // 4. Order Ledger Table
      doc.fillColor(darkSlate).font("Helvetica-Bold").fontSize(13).text("Order Ledger", 50, 220);

      const tableStartY = 240;
      doc.rect(50, tableStartY, doc.page.width - 100, 20).fill(tableHeaderBg);

      // Ledger Table Headers
      doc.fillColor(darkSlate).font("Helvetica-Bold").fontSize(9);
      doc.text("Order Number", 50, tableStartY + 6, { width: 150 });
      doc.text("Date", 205, tableStartY + 6, { width: 60 });
      doc.text("Payment Method", 270, tableStartY + 6, { width: 85 });
      doc.text("Status", 360, tableStartY + 6, { width: 90 });
      doc.text("Grand Total", 455, tableStartY + 6, { width: doc.page.width - 50 - 455, align: "right" });

      let currentY = tableStartY + 20;

      orders.forEach((order, index) => {
        // Page break calculation
        if (currentY > doc.page.height - 80) {
          doc.addPage();
          // Draw top accent banner on the new page
          doc.rect(0, 0, doc.page.width, 12).fill(brandColor);
          
          // Re-draw headers on new page
          doc.rect(50, 40, doc.page.width - 100, 20).fill(tableHeaderBg);
          doc.fillColor(darkSlate).font("Helvetica-Bold").fontSize(9);
          doc.text("Order Number", 50, 46, { width: 150 });
          doc.text("Date", 205, 46, { width: 60 });
          doc.text("Payment Method", 270, 46, { width: 85 });
          doc.text("Status", 360, 46, { width: 90 });
          doc.text("Grand Total", 455, 46, { width: doc.page.width - 50 - 455, align: "right" });
          
          currentY = 60;
        }

        // Alternating row background shading
        if (index % 2 === 1) {
          doc.rect(50, currentY, doc.page.width - 100, 20).fill("#FAFAFA");
        }

        doc.fillColor(darkSlate).font("Helvetica").fontSize(8);
        doc.text(order.orderNumber, 50, currentY + 6, { width: 150 });
        doc.text(new Date(order.createdAt).toLocaleDateString(), 205, currentY + 6, { width: 60 });
        doc.text(order.paymentMethod || "N/A", 270, currentY + 6, { width: 85 });
        doc.text(order.status || "N/A", 360, currentY + 6, { width: 90 });
        doc.text(`INR ${Number(order.grandTotal || 0).toFixed(2)}`, 455, currentY + 6, { width: doc.page.width - 50 - 455, align: "right" });

        // Light bottom border line
        doc.strokeColor(borderBg).lineWidth(0.5).moveTo(50, currentY + 20).lineTo(doc.page.width - 50, currentY + 20).stroke();
        currentY += 20;
      });

      // Footer
      doc.strokeColor(borderBg).lineWidth(1).moveTo(50, doc.page.height - 50).lineTo(doc.page.width - 50, doc.page.height - 50).stroke();
      doc.fillColor(lightSlate).font("Helvetica").fontSize(8).text("Veloshop Administration Panel - Confidential Sales Report", 50, doc.page.height - 40, { align: "center", width: doc.page.width - 100 });

      doc.end();
    }
  } catch (error) {
    console.error("Download sales report error:", error);
    res.status(500).send("Report download failed.");
  }
};

export const getLedgerBook = async (req, res) => {
  try {
    const Order = (await import("../models/Order.js")).default;
    const Transaction = (await import("../models/Transaction.js")).default;

    // Fetch all successful/paid orders to track payments, discounts, coupons, refunds
    const orders = await Order.find({}).populate("userId").sort({ createdAt: -1 });

    // Fetch wallet transactions to track wallet credits and debits
    const walletTransactions = await Transaction.find({}).populate("userId").sort({ createdAt: -1 });

    const ledgerEntries = [];

    // Map orders to ledger entries
    orders.forEach(order => {
      const userEmail = order.userId?.email || "Unknown User";

      // 1. Order Payments (Revenue)
      if (order.paymentStatus === "SUCCESS") {
        ledgerEntries.push({
          date: order.createdAt,
          type: "Order Payment",
          reference: order.orderNumber,
          user: userEmail,
          incoming: order.grandTotal,
          outgoing: 0,
          details: `Paid via ${order.paymentMethod}`
        });
      }

      // 2. Refunds (outgoing money for cancelled/returned orders)
      if (order.status === "CANCELLED" && order.refundStatus === "REFUNDED") {
        ledgerEntries.push({
          date: order.updatedAt,
          type: "Refund",
          reference: order.orderNumber,
          user: userEmail,
          incoming: 0,
          outgoing: order.grandTotal,
          details: "Refunded to wallet (Cancelled Order)"
        });
      } else if (order.status === "RETURNED" && order.refundStatus === "REFUNDED") {
        ledgerEntries.push({
          date: order.updatedAt,
          type: "Refund",
          reference: order.orderNumber,
          user: userEmail,
          incoming: 0,
          outgoing: order.grandTotal,
          details: "Refunded to wallet (Approved Return)"
        });
      }

      // 3. Discounts (Offer discount value tracked as deduction/loss)
      if (order.offerDiscount > 0) {
        ledgerEntries.push({
          date: order.createdAt,
          type: "Discount Adjustment",
          reference: order.orderNumber,
          user: userEmail,
          incoming: 0,
          outgoing: order.offerDiscount,
          details: "Offer discount applied to order"
        });
      }

      // 4. Coupon Deductions
      if (order.couponDiscount > 0) {
        ledgerEntries.push({
          date: order.createdAt,
          type: "Coupon Deduction",
          reference: order.orderNumber,
          user: userEmail,
          incoming: 0,
          outgoing: order.couponDiscount,
          details: `Promo coupon applied to order`
        });
      }
    });

    // Map wallet transactions to ledger entries
    walletTransactions.forEach(tx => {
      const userEmail = tx.userId?.email || "Unknown User";

      if (tx.transactionType === "CREDIT") {
        ledgerEntries.push({
          date: tx.createdAt,
          type: "Wallet Credit",
          reference: tx.referenceId || "Wallet",
          user: userEmail,
          incoming: tx.amount,
          outgoing: 0,
          details: tx.description || "Credit adjustment"
        });
      } else if (tx.transactionType === "DEBIT") {
        ledgerEntries.push({
          date: tx.createdAt,
          type: "Wallet Debit",
          reference: tx.referenceId || "Wallet",
          user: userEmail,
          incoming: 0,
          outgoing: tx.amount,
          details: tx.description || "Debit payment"
        });
      }
    });

    // Sort combined entries chronologically (most recent first)
    ledgerEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate dynamic ledger running balance totals
    let totalIncoming = 0;
    let totalOutgoing = 0;
    ledgerEntries.forEach(entry => {
      totalIncoming += entry.incoming;
      totalOutgoing += entry.outgoing;
    });

    res.render("admin/ledger", {
      layout: "layouts/admin-layout",
      title: "Veloshop Ledger Book",
      path: "/admin/ledger",
      entries: ledgerEntries,
      summary: {
        totalIncoming,
        totalOutgoing,
        netCashFlow: totalIncoming - totalOutgoing
      }
    });
  } catch (error) {
    console.error("Get ledger book failed:", error);
    req.session.errorMessage = "Failed to load ledger book.";
    res.redirect("/admin/dashboard");
  }
};
