import Category from "../models/Category.js";
import { categorySchema } from "../validators/categoryValidator.js";

const PAGE_SIZE = 8;

const slugify = (value) => {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const validateCategory = (body) => {
  const { error, value } = categorySchema.validate(body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    return {
      errors: error.details.map((detail) => detail.message),
      value
    };
  }

  return { errors: [], value };
};

const setFlash = (req, type, message) => {
  if (type === "success") {
    req.session.successMessage = message;
  } else {
    req.session.errorMessage = message;
  }
};

const buildCategoryQuery = ({ search, status }) => {
  const query = {};

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { slug: { $regex: search, $options: "i" } }
    ];
  }

  if (status === "active") {
    query.isDeleted = false;
    query.isActive = true;
  } else if (status === "inactive") {
    query.isDeleted = false;
    query.isActive = false;
  } else if (status === "deleted") {
    query.isDeleted = true;
  } else {
    query.isDeleted = false;
  }

  return query;
};

const ensureUniqueCategory = async ({ slug, excludeId = null }) => {
  const query = { slug };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return Category.findOne(query);
};

export const getCategories = async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const status = req.query.status || "active";
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const sort = req.query.sort === "asc" ? "asc" : "desc";
    const sortDirection = sort === "asc" ? 1 : -1;
    const query = buildCategoryQuery({ search, status });

    const [categories, totalCategories] = await Promise.all([
      Category.find(query)
        .sort({ createdAt: sortDirection })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE),
      Category.countDocuments(query)
    ]);

    const totalPages = Math.max(Math.ceil(totalCategories / PAGE_SIZE), 1);

    res.render("admin/categories", {
      layout: "layouts/admin-layout",
      title: "Category Management - Veloshop",
      categories,
      search,
      status,
      sort,
      page,
      totalPages,
      totalCategories
    });
  } catch (error) {
    console.error("Category list error:", error);
    setFlash(req, "error", "Failed to load categories.");
    res.redirect("/admin/users");
  }
};

export const getNewCategory = (req, res) => {
  res.render("admin/category-form", {
    layout: "layouts/admin-layout",
    title: "Add Category - Veloshop",
    mode: "create",
    category: null,
    formErrors: []
  });
};

export const createCategory = async (req, res) => {
  try {
    const { errors, value } = validateCategory(req.body);
    if (errors.length) {
      return res.status(400).render("admin/category-form", {
        layout: "layouts/admin-layout",
        title: "Add Category - Veloshop",
        mode: "create",
        category: req.body,
        formErrors: errors
      });
    }

    const slug = slugify(value.name);
    if (!slug) {
      return res.status(400).render("admin/category-form", {
        layout: "layouts/admin-layout",
        title: "Add Category - Veloshop",
        mode: "create",
        category: req.body,
        formErrors: ["Category name must contain letters or numbers."]
      });
    }

    const existingCategory = await ensureUniqueCategory({ slug });

    if (existingCategory) {
      const message = existingCategory.isDeleted
        ? "This category already exists in deleted categories. Restore it before reusing this name."
        : "A category with this name already exists.";

      return res.status(409).render("admin/category-form", {
        layout: "layouts/admin-layout",
        title: "Add Category - Veloshop",
        mode: "create",
        category: req.body,
        formErrors: [message]
      });
    }

    await Category.create({
      name: value.name,
      slug,
      isActive: value.isActive === "on" || value.isActive === true || value.isActive === "true"
    });

    setFlash(req, "success", "Category created successfully.");
    res.redirect("/admin/categories");
  } catch (error) {
    console.error("Create category error:", error);
    setFlash(req, "error", "Failed to create category.");
    res.redirect("/admin/categories/new");
  }
};

export const getEditCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      setFlash(req, "error", "Category not found.");
      return res.redirect("/admin/categories");
    }

    res.render("admin/category-form", {
      layout: "layouts/admin-layout",
      title: "Edit Category - Veloshop",
      mode: "edit",
      category,
      formErrors: []
    });
  } catch (error) {
    console.error("Edit category view error:", error);
    setFlash(req, "error", "Failed to load category.");
    res.redirect("/admin/categories");
  }
};

export const updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      setFlash(req, "error", "Category not found.");
      return res.redirect("/admin/categories");
    }

    if (category.isDeleted) {
      setFlash(req, "error", "Restore this category before editing it.");
      return res.redirect("/admin/categories?status=deleted");
    }

    const { errors, value } = validateCategory(req.body);
    if (errors.length) {
      return res.status(400).render("admin/category-form", {
        layout: "layouts/admin-layout",
        title: "Edit Category - Veloshop",
        mode: "edit",
        category: { ...category.toObject(), ...req.body },
        formErrors: errors
      });
    }

    const slug = slugify(value.name);
    if (!slug) {
      return res.status(400).render("admin/category-form", {
        layout: "layouts/admin-layout",
        title: "Edit Category - Veloshop",
        mode: "edit",
        category: { ...category.toObject(), ...req.body },
        formErrors: ["Category name must contain letters or numbers."]
      });
    }

    const existingCategory = await ensureUniqueCategory({ slug, excludeId: category._id });

    if (existingCategory) {
      return res.status(409).render("admin/category-form", {
        layout: "layouts/admin-layout",
        title: "Edit Category - Veloshop",
        mode: "edit",
        category: { ...category.toObject(), ...req.body },
        formErrors: ["A category with this name already exists."]
      });
    }

    category.name = value.name;
    category.slug = slug;
    category.isActive = value.isActive === "on" || value.isActive === true || value.isActive === "true";
    await category.save();

    setFlash(req, "success", "Category updated successfully.");
    res.redirect("/admin/categories");
  } catch (error) {
    console.error("Update category error:", error);
    setFlash(req, "error", "Failed to update category.");
    res.redirect("/admin/categories");
  }
};

export const softDeleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found." });
    }

    category.isDeleted = true;
    category.deletedAt = new Date();
    category.isActive = false;
    await category.save();

    return res.status(200).json({
      success: true,
      message: "Category moved to deleted list."
    });
  } catch (error) {
    console.error("Soft delete category error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete category." });
  }
};

export const restoreCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found." });
    }

    category.isDeleted = false;
    category.deletedAt = null;
    category.isActive = true;
    await category.save();

    return res.status(200).json({
      success: true,
      message: "Category restored successfully."
    });
  } catch (error) {
    console.error("Restore category error:", error);
    return res.status(500).json({ success: false, message: "Failed to restore category." });
  }
};

export const toggleCategoryStatus = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found." });
    }

    if (category.isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Restore this category before changing status."
      });
    }

    category.isActive = !category.isActive;
    await category.save();

    return res.status(200).json({
      success: true,
      message: `Category ${category.isActive ? "activated" : "deactivated"} successfully.`
    });
  } catch (error) {
    console.error("Toggle category status error:", error);
    return res.status(500).json({ success: false, message: "Failed to update category status." });
  }
};
