import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { productSchema } from "../validators/productValidator.js";

const PAGE_SIZE = 8;

const slugify = (value) => {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const parseTags = (tags) => {
  if (!tags) {
    return [];
  }

  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const serializeTags = (product) => {
  if (!product?.tags) {
    return "";
  }

  return product.tags.join(", ");
};

const normalizeFeatured = (value) => {
  return value === "on" || value === "true" || value === true;
};

const validateProduct = (body) => {
  const { error, value } = productSchema.validate(body, {
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

const getActiveCategories = () => {
  return Category.find({ isDeleted: false, isActive: true }).sort({ name: 1 });
};

const buildProductQuery = ({ search, status, categoryId }) => {
  const query = {};

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { brand: { $regex: search, $options: "i" } },
      { slug: { $regex: search, $options: "i" } }
    ];
  }

  if (status === "active") {
    query.isDeleted = false;
    query.status = "ACTIVE";
  } else if (status === "inactive") {
    query.isDeleted = false;
    query.status = "INACTIVE";
  } else if (status === "deleted") {
    query.isDeleted = true;
  } else {
    query.isDeleted = false;
  }

  if (categoryId && categoryId !== "all") {
    query.categoryId = categoryId;
  }

  return query;
};

const ensureUniqueProduct = async ({ slug, excludeId = null }) => {
  const query = { slug };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return Product.findOne(query);
};

const renderProductForm = async ({ req, res, mode, product = null, formErrors = [], statusCode = 200 }) => {
  const categories = await getActiveCategories();

  return res.status(statusCode).render("admin/product-form", {
    layout: "layouts/admin-layout",
    title: mode === "edit" ? "Edit Product - Veloshop" : "Add Product - Veloshop",
    mode,
    product,
    categories,
    formErrors,
    tagValue: typeof product?.tags === "string" ? product.tags : serializeTags(product)
  });
};

export const getProducts = async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const status = req.query.status || "active";
    const categoryId = req.query.categoryId || "all";
    const sort = req.query.sort === "asc" ? "asc" : "desc";
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const query = buildProductQuery({ search, status, categoryId });
    const sortDirection = sort === "asc" ? 1 : -1;

    const [products, totalProducts, categories] = await Promise.all([
      Product.find(query)
        .populate("categoryId", "name slug")
        .sort({ createdAt: sortDirection })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE),
      Product.countDocuments(query),
      Category.find({ isDeleted: false }).sort({ name: 1 })
    ]);

    const totalPages = Math.max(Math.ceil(totalProducts / PAGE_SIZE), 1);

    res.render("admin/products", {
      layout: "layouts/admin-layout",
      title: "Product Management - Veloshop",
      products,
      categories,
      search,
      status,
      categoryId,
      sort,
      page,
      totalPages,
      totalProducts
    });
  } catch (error) {
    console.error("Product list error:", error);
    setFlash(req, "error", "Failed to load products.");
    res.redirect("/admin/users");
  }
};

export const getNewProduct = async (req, res) => {
  await renderProductForm({
    req,
    res,
    mode: "create",
    product: null
  });
};

export const createProduct = async (req, res) => {
  try {
    const { errors, value } = validateProduct(req.body);
    if (errors.length) {
      return renderProductForm({
        req,
        res,
        mode: "create",
        product: req.body,
        formErrors: errors,
        statusCode: 400
      });
    }

    const category = await Category.findOne({
      _id: value.categoryId,
      isDeleted: false,
      isActive: true
    });

    if (!category) {
      return renderProductForm({
        req,
        res,
        mode: "create",
        product: req.body,
        formErrors: ["Please select an active category."],
        statusCode: 400
      });
    }

    const slug = slugify(value.name);
    if (!slug) {
      return renderProductForm({
        req,
        res,
        mode: "create",
        product: req.body,
        formErrors: ["Product name must contain letters or numbers."],
        statusCode: 400
      });
    }

    const existingProduct = await ensureUniqueProduct({ slug });
    if (existingProduct) {
      const message = existingProduct.isDeleted
        ? "This product already exists in deleted products. Restore it before reusing this name."
        : "A product with this name already exists.";

      return renderProductForm({
        req,
        res,
        mode: "create",
        product: req.body,
        formErrors: [message],
        statusCode: 409
      });
    }

    await Product.create({
      name: value.name,
      slug,
      description: value.description,
      brand: value.brand,
      categoryId: value.categoryId,
      thumbnail: value.thumbnail || "",
      tags: parseTags(value.tags),
      isFeatured: normalizeFeatured(value.isFeatured),
      status: value.status
    });

    setFlash(req, "success", "Product created successfully.");
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Create product error:", error);
    setFlash(req, "error", "Failed to create product.");
    res.redirect("/admin/products/new");
  }
};

export const getEditProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      setFlash(req, "error", "Product not found.");
      return res.redirect("/admin/products");
    }

    return renderProductForm({
      req,
      res,
      mode: "edit",
      product
    });
  } catch (error) {
    console.error("Edit product view error:", error);
    setFlash(req, "error", "Failed to load product.");
    res.redirect("/admin/products");
  }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      setFlash(req, "error", "Product not found.");
      return res.redirect("/admin/products");
    }

    if (product.isDeleted) {
      setFlash(req, "error", "Restore this product before editing it.");
      return res.redirect("/admin/products?status=deleted");
    }

    const { errors, value } = validateProduct(req.body);
    if (errors.length) {
      return renderProductForm({
        req,
        res,
        mode: "edit",
        product: { ...product.toObject(), ...req.body },
        formErrors: errors,
        statusCode: 400
      });
    }

    const category = await Category.findOne({
      _id: value.categoryId,
      isDeleted: false,
      isActive: true
    });

    if (!category) {
      return renderProductForm({
        req,
        res,
        mode: "edit",
        product: { ...product.toObject(), ...req.body },
        formErrors: ["Please select an active category."],
        statusCode: 400
      });
    }

    const slug = slugify(value.name);
    if (!slug) {
      return renderProductForm({
        req,
        res,
        mode: "edit",
        product: { ...product.toObject(), ...req.body },
        formErrors: ["Product name must contain letters or numbers."],
        statusCode: 400
      });
    }

    const existingProduct = await ensureUniqueProduct({ slug, excludeId: product._id });
    if (existingProduct) {
      return renderProductForm({
        req,
        res,
        mode: "edit",
        product: { ...product.toObject(), ...req.body },
        formErrors: ["A product with this name already exists."],
        statusCode: 409
      });
    }

    product.name = value.name;
    product.slug = slug;
    product.description = value.description;
    product.brand = value.brand;
    product.categoryId = value.categoryId;
    product.thumbnail = value.thumbnail || "";
    product.tags = parseTags(value.tags);
    product.isFeatured = normalizeFeatured(value.isFeatured);
    product.status = value.status;
    await product.save();

    setFlash(req, "success", "Product updated successfully.");
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Update product error:", error);
    setFlash(req, "error", "Failed to update product.");
    res.redirect("/admin/products");
  }
};

export const softDeleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    product.isDeleted = true;
    product.deletedAt = new Date();
    product.status = "INACTIVE";
    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product moved to deleted list."
    });
  } catch (error) {
    console.error("Soft delete product error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete product." });
  }
};

export const restoreProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    product.isDeleted = false;
    product.deletedAt = null;
    product.status = "ACTIVE";
    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product restored successfully."
    });
  } catch (error) {
    console.error("Restore product error:", error);
    return res.status(500).json({ success: false, message: "Failed to restore product." });
  }
};

export const toggleProductStatus = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    if (product.isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Restore this product before changing status."
      });
    }

    product.status = product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await product.save();

    return res.status(200).json({
      success: true,
      message: `Product ${product.status === "ACTIVE" ? "activated" : "deactivated"} successfully.`
    });
  } catch (error) {
    console.error("Toggle product status error:", error);
    return res.status(500).json({ success: false, message: "Failed to update product status." });
  }
};
