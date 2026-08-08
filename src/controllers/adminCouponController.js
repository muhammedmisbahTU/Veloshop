import Coupon from "../models/Coupon.js";
import { couponSchema } from "../validators/couponValidator.js";

const PAGE_SIZE_DEFAULT = 5;

const setFlash = (req, type, message) => {
  if (type === "success") {
    req.session.successMessage = message;
  } else {
    req.session.errorMessage = message;
  }
};

const validateCoupon = (body) => {
  const { error, value } = couponSchema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return {
      errors: error.details.map((detail) => detail.message),
      value,
    };
  }

  return {
    errors: [],
    value,
  };
};

const renderCouponForm = async ({
  req,
  res,
  mode,
  coupon = null,
  formErrors = [],
  statusCode = 200,
}) => {
  return res.status(statusCode).render("admin/coupon-form", {
    layout: "layouts/admin-layout",
    title: mode === "edit" ? "Edit Coupon - Veloshop" : "Create Coupon - Veloshop",
    mode,
    coupon,
    formErrors,
  });
};

const buildCouponQuery = ({ search, status, type }) => {
  const query = {};

  if (search) {
    query.code = {
      $regex: search,
      $options: "i",
    };
  }

  switch (status) {
    case "active":
      query.isDeleted = false;
      query.isActive = true;
      break;
    case "disabled":
      query.isDeleted = false;
      query.isActive = false;
      break;
    case "deleted":
      query.isDeleted = true;
      break;
    case "expired":
      query.expiryDate = {
        $lt: new Date(),
      };
      query.isDeleted = false;
      break;
    case "upcoming":
      query.startDate = {
        $gt: new Date(),
      };
      query.isDeleted = false;
      break;
    default:
      query.isDeleted = false;
  }

  if (type && type !== "all") {
    query.discountType = type;
  }

  return query;
};

export const getCoupons = async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const status = req.query.status || "all";
    const type = req.query.type || "all";
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || PAGE_SIZE_DEFAULT, 20);

    const query = buildCouponQuery({
      search,
      status,
      type,
    });

    const [coupons, totalCoupons] = await Promise.all([
      Coupon.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Coupon.countDocuments(query),
    ]);

    const [activeCount, disabledCount, deletedCount] = await Promise.all([
      Coupon.countDocuments({ isDeleted: false, isActive: true }),
      Coupon.countDocuments({ isDeleted: false, isActive: false }),
      Coupon.countDocuments({ isDeleted: true }),
    ]);

    const formattedCoupons = coupons.map((coupon) => {
      const now = new Date();
      let remainingText = "";

      if (now < new Date(coupon.startDate)) {
        const days = Math.ceil((new Date(coupon.startDate) - now) / (1000 * 60 * 60 * 24));
        remainingText = `Starts in ${days} days`;
      } else if (now > new Date(coupon.expiryDate)) {
        const days = Math.floor((now - new Date(coupon.expiryDate)) / (1000 * 60 * 60 * 24));
        remainingText = `Expired ${days} days ago`;
      } else {
        const days = Math.ceil((new Date(coupon.expiryDate) - now) / (1000 * 60 * 60 * 24));
        remainingText = `${days} days remaining`;
      }

      return {
        ...coupon,
        remainingText,
      };
    });

    const totalPages = Math.ceil(totalCoupons / limit);

    res.render("admin/coupons", {
      layout: "layouts/admin-layout",
      title: "Coupon Management - Veloshop",
      coupons: formattedCoupons,
      pagination: {
        page,
        limit,
        totalPages,
        totalCoupons,
      },
      filters: {
        search,
        status,
        type,
      },
      counts: {
        active: activeCount,
        disabled: disabledCount,
        deleted: deletedCount,
        total: activeCount + disabledCount,
      },
    });
  } catch (error) {
    console.error("Coupon list error:", error);
    setFlash(req, "error", "Failed to load coupons");
    res.redirect("/admin");
  }
};

export const getNewCoupon = async (req, res) => {
  return renderCouponForm({
    req,
    res,
    mode: "create",
    coupon: null,
  });
};

export const createCoupon = async (req, res) => {
  try {
    const { errors, value } = validateCoupon(req.body);

    if (errors.length) {
      return renderCouponForm({
        req,
        res,
        mode: "create",
        coupon: req.body,
        formErrors: errors,
        statusCode: 400,
      });
    }

    // Check if startDate is after expiryDate
    if (new Date(value.startDate) >= new Date(value.expiryDate)) {
      return renderCouponForm({
        req,
        res,
        mode: "create",
        coupon: req.body,
        formErrors: ["Expiry date must be after start date."],
        statusCode: 400,
      });
    }

    // Check duplicate code
    const existingCoupon = await Coupon.findOne({
      code: value.code.toUpperCase(),
      isDeleted: false,
    });

    if (existingCoupon) {
      return renderCouponForm({
        req,
        res,
        mode: "create",
        coupon: req.body,
        formErrors: ["A coupon with this code already exists."],
        statusCode: 409,
      });
    }

    await Coupon.create({
      code: value.code.toUpperCase(),
      description: value.description,
      discountType: value.discountType,
      discountValue: value.discountValue,
      minimumPurchase: value.minimumPurchase || 0,
      maximumDiscount: value.discountType === "PERCENTAGE" ? (value.maximumDiscount || null) : null,
      startDate: value.startDate,
      expiryDate: value.expiryDate,
      usageLimit: value.usageLimit || null,
      usagePerUser: value.usagePerUser || 1,
      isActive: true,
      isDeleted: false,
    });

    setFlash(req, "success", "Coupon created successfully.");
    res.redirect("/admin/coupons");
  } catch (error) {
    console.error("Create coupon error:", error);
    return renderCouponForm({
      req,
      res,
      mode: "create",
      coupon: req.body,
      formErrors: ["Internal server error. Please try again."],
      statusCode: 500,
    });
  }
};

export const toggleCouponStatus = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found.",
      });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    return res.status(200).json({
      success: true,
      message: `Coupon has been ${coupon.isActive ? "activated" : "disabled"}.`,
      isActive: coupon.isActive,
    });
  } catch (error) {
    console.error("Toggle coupon status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update coupon status.",
    });
  }
};

export const softDeleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found.",
      });
    }

    coupon.isDeleted = true;
    coupon.isActive = false;
    await coupon.save();

    return res.status(200).json({
      success: true,
      message: "Coupon deleted successfully.",
    });
  } catch (error) {
    console.error("Delete coupon error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete coupon.",
    });
  }
};

export const restoreCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found.",
      });
    }

    coupon.isDeleted = false;
    coupon.isActive = true;
    await coupon.save();

    return res.status(200).json({
      success: true,
      message: "Coupon restored successfully.",
    });
  } catch (error) {
    console.error("Restore coupon error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore coupon.",
    });
  }
};

export const getEditCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      setFlash(req, "error", "Coupon not found");
      return res.redirect("/admin/coupons");
    }
    return renderCouponForm({
      req,
      res,
      mode: "edit",
      coupon,
    });
  } catch (error) {
    console.error("Get edit coupon error:", error);
    setFlash(req, "error", "Failed to load coupon");
    res.redirect("/admin/coupons");
  }
};

export const updateCoupon = async (req, res) => {
  try {
    const { errors, value } = validateCoupon(req.body);

    if (errors.length) {
      return renderCouponForm({
        req,
        res,
        mode: "edit",
        coupon: { ...req.body, _id: req.params.id },
        formErrors: errors,
        statusCode: 400,
      });
    }

    if (new Date(value.startDate) >= new Date(value.expiryDate)) {
      return renderCouponForm({
        req,
        res,
        mode: "edit",
        coupon: { ...req.body, _id: req.params.id },
        formErrors: ["Expiry date must be after start date."],
        statusCode: 400,
      });
    }

    // Check duplicate code excluding current coupon
    const existingCoupon = await Coupon.findOne({
      code: value.code.toUpperCase(),
      isDeleted: false,
      _id: { $ne: req.params.id },
    });

    if (existingCoupon) {
      return renderCouponForm({
        req,
        res,
        mode: "edit",
        coupon: { ...req.body, _id: req.params.id },
        formErrors: ["A coupon with this code already exists."],
        statusCode: 409,
      });
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      {
        code: value.code.toUpperCase(),
        description: value.description,
        discountType: value.discountType,
        discountValue: value.discountValue,
        minimumPurchase: value.minimumPurchase || 0,
        maximumDiscount: value.discountType === "PERCENTAGE" ? (value.maximumDiscount || null) : null,
        startDate: value.startDate,
        expiryDate: value.expiryDate,
        usageLimit: value.usageLimit || null,
        usagePerUser: value.usagePerUser || 1,
      },
      { new: true }
    );

    if (!updatedCoupon) {
      setFlash(req, "error", "Coupon not found");
      return res.redirect("/admin/coupons");
    }

    setFlash(req, "success", "Coupon updated successfully.");
    res.redirect("/admin/coupons");
  } catch (error) {
    console.error("Update coupon error:", error);
    return renderCouponForm({
      req,
      res,
      mode: "edit",
      coupon: { ...req.body, _id: req.params.id },
      formErrors: ["Internal server error. Please try again."],
      statusCode: 500,
    });
  }
};

