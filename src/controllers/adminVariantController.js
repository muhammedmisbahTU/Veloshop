import Product from "../models/Product.js";
import Variant from "../models/Variant.js";
import { variantSchema } from "../validators/variantValidator.js";

const MIN_VARIANT_IMAGES = 3;

const getUploadedImageUrls = (files = []) => {
  return files.map((file) => file.path || file.secure_url || file.url).filter(Boolean);
};

const normalizeBoolean = (value) => {
  return value === "on" || value === "true" || value === true;
};

const asArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value == null) {
    return [];
  }

  return [value];
};

const parseAttributes = (body) => {
  const names = asArray(body.attributeName);
  const values = asArray(body.attributeValue);

  if (names.length || values.length) {
    return names
      .map((name, index) => ({
        name: (name || "").trim(),
        value: (values[index] || "").trim()
      }))
      .filter((attribute) => attribute.name && attribute.value);
  }

  if (Array.isArray(body.attributes)) {
    return body.attributes
      .map((attribute) => ({
        name: (attribute.name || "").trim(),
        value: (attribute.value || "").trim()
      }))
      .filter((attribute) => attribute.name && attribute.value);
  }

  if (!body.attributes || typeof body.attributes !== "string") {
    return [];
  }

  return body.attributes
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, ...rest] = entry.split(":");
      return {
        name: (name || "").trim(),
        value: rest.join(":").trim()
      };
    })
    .filter((attribute) => attribute.name && attribute.value);
};

const validateAttributeRows = (body) => {
  const names = asArray(body.attributeName);
  const values = asArray(body.attributeValue);
  const errors = [];

  names.forEach((name, index) => {
    const cleanName = (name || "").trim();
    const cleanValue = (values[index] || "").trim();

    if ((cleanName && !cleanValue) || (!cleanName && cleanValue)) {
      errors.push(`Attribute row ${index + 1} needs both a name and a value.`);
    }
  });

  return errors;
};

const serializeAttributes = (variant) => {
  if (!variant?.attributes?.length) {
    return "";
  }

  return variant.attributes
    .map((attribute) => `${attribute.name}: ${attribute.value}`)
    .join(", ");
};

const getAttributeRows = (variant) => {
  if (!variant) {
    return [
      { name: "Color", value: "" },
      { name: "Size", value: "" }
    ];
  }

  const attributes = parseAttributes(variant);
  return attributes.length ? attributes : [{ name: "", value: "" }];
};

const skuPart = (value) => {
  return value
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const buildSkuBase = (product, attributes) => {
  const productPart = skuPart(product.slug || product.name).slice(0, 28) || "PRODUCT";
  const attributePart = attributes
    .map((attribute) => skuPart(attribute.value || attribute.name))
    .filter(Boolean)
    .join("-")
    .slice(0, 38);

  return attributePart ? `${productPart}-${attributePart}` : productPart;
};

const generateUniqueSku = async ({ product, attributes, excludeId = null }) => {
  const baseSku = buildSkuBase(product, attributes).slice(0, 70);
  let sku = baseSku;
  let counter = 2;

  while (await ensureUniqueSku({ sku, excludeId })) {
    sku = `${baseSku}-${counter}`.slice(0, 80);
    counter += 1;
  }

  return sku;
};

const validateVariant = (body) => {
  const { error, value } = variantSchema.validate(body, {
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

const getProductOrRedirect = async (req, res, productId) => {
  const product = await Product.findOne({ _id: productId, isDeleted: false });
  if (!product) {
    setFlash(req, "error", "Product not found.");
    res.redirect("/admin/products");
    return null;
  }

  return product;
};

const renderVariantForm = ({ req, res, mode, product, variant = null, formErrors = [], statusCode = 200 }) => {
  return res.status(statusCode).render("admin/variant-form", {
    layout: "layouts/admin-layout",
    title: mode === "edit" ? "Edit Variant - Veloshop" : "Add Variant - Veloshop",
    mode,
    product,
    variant,
    formErrors,
    attributeValue: typeof variant?.attributes === "string" ? variant.attributes : serializeAttributes(variant),
    attributeRows: getAttributeRows(variant),
    skuBase: skuPart(product.slug || product.name),
    minImages: MIN_VARIANT_IMAGES
  });
};

const ensureUniqueSku = async ({ sku, excludeId = null }) => {
  const query = { sku };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return Variant.findOne(query);
};

export const getVariants = async (req, res) => {
  try {
    const product = await getProductOrRedirect(req, res, req.params.productId);
    if (!product) {
      return;
    }

    const variants = await Variant.find({ productId: product._id }).sort({ createdAt: -1 });

    res.render("admin/variants", {
      layout: "layouts/admin-layout",
      title: "Variant Management - Veloshop",
      product,
      variants,
      minImages: MIN_VARIANT_IMAGES
    });
  } catch (error) {
    console.error("Variant list error:", error);
    setFlash(req, "error", "Failed to load variants.");
    res.redirect("/admin/products");
  }
};

export const getNewVariant = async (req, res) => {
  const product = await getProductOrRedirect(req, res, req.params.productId);
  if (!product) {
    return;
  }

  renderVariantForm({
    req,
    res,
    mode: "create",
    product,
    variant: null
  });
};

export const createVariant = async (req, res) => {
  try {
    const product = await getProductOrRedirect(req, res, req.params.productId);
    if (!product) {
      return;
    }

    const uploadedImages = getUploadedImageUrls(req.files);
    const { errors, value } = validateVariant(req.body);
    const formErrors = [...errors];
    const attributes = parseAttributes(req.body);
    formErrors.push(...validateAttributeRows(req.body));
    if (!attributes.length) {
      formErrors.push("Add at least one variant attribute.");
    }
    const requestedSku = (value.sku || "").trim().toUpperCase();
    const sku = requestedSku || await generateUniqueSku({ product, attributes });

    if (uploadedImages.length < MIN_VARIANT_IMAGES) {
      formErrors.push(`Upload at least ${MIN_VARIANT_IMAGES} variant images.`);
    }

    if (value.salePrice !== "" && value.salePrice != null && Number(value.salePrice) > Number(value.regularPrice)) {
      formErrors.push("Sale price cannot be greater than regular price.");
    }

    const existingVariant = sku ? await ensureUniqueSku({ sku }) : null;
    if (existingVariant) {
      formErrors.push("A variant with this SKU already exists.");
    }

    if (formErrors.length) {
      return renderVariantForm({
        req,
        res,
        mode: "create",
        product,
        variant: { ...req.body, sku, attributes },
        formErrors,
        statusCode: 400
      });
    }

    await Variant.create({
      productId: product._id,
      sku,
      stock: Number(value.stock),
      regularPrice: Number(value.regularPrice),
      salePrice: value.salePrice === "" || value.salePrice == null ? undefined : Number(value.salePrice),
      images: uploadedImages,
      isActive: normalizeBoolean(value.isActive),
      attributes
    });

    setFlash(req, "success", "Variant created successfully.");
    res.redirect(`/admin/products/${product._id}/variants`);
  } catch (error) {
    console.error("Create variant error:", error);
    setFlash(req, "error", "Failed to create variant.");
    res.redirect(`/admin/products/${req.params.productId}/variants/new`);
  }
};

export const getEditVariant = async (req, res) => {
  try {
    const variant = await Variant.findById(req.params.variantId).populate("productId");
    if (!variant || !variant.productId || variant.productId.isDeleted) {
      setFlash(req, "error", "Variant not found.");
      return res.redirect("/admin/products");
    }

    return renderVariantForm({
      req,
      res,
      mode: "edit",
      product: variant.productId,
      variant
    });
  } catch (error) {
    console.error("Edit variant view error:", error);
    setFlash(req, "error", "Failed to load variant.");
    res.redirect("/admin/products");
  }
};

export const updateVariant = async (req, res) => {
  try {
    const variant = await Variant.findById(req.params.variantId).populate("productId");
    if (!variant || !variant.productId || variant.productId.isDeleted) {
      setFlash(req, "error", "Variant not found.");
      return res.redirect("/admin/products");
    }

    const uploadedImages = getUploadedImageUrls(req.files);
    const replaceImages = normalizeBoolean(req.body.replaceImages);
    const nextImages = replaceImages ? uploadedImages : [...variant.images, ...uploadedImages];
    const { errors, value } = validateVariant(req.body);
    const formErrors = [...errors];
    const attributes = parseAttributes(req.body);
    formErrors.push(...validateAttributeRows(req.body));
    if (!attributes.length) {
      formErrors.push("Add at least one variant attribute.");
    }
    const requestedSku = (value.sku || "").trim().toUpperCase();
    const sku = requestedSku || await generateUniqueSku({
      product: variant.productId,
      attributes,
      excludeId: variant._id
    });

    if (nextImages.length < MIN_VARIANT_IMAGES) {
      formErrors.push(`Each variant must have at least ${MIN_VARIANT_IMAGES} images.`);
    }

    if (replaceImages && uploadedImages.length < MIN_VARIANT_IMAGES) {
      formErrors.push(`To replace images, upload at least ${MIN_VARIANT_IMAGES} new images.`);
    }

    if (value.salePrice !== "" && value.salePrice != null && Number(value.salePrice) > Number(value.regularPrice)) {
      formErrors.push("Sale price cannot be greater than regular price.");
    }

    const existingVariant = sku ? await ensureUniqueSku({ sku, excludeId: variant._id }) : null;
    if (existingVariant) {
      formErrors.push("A variant with this SKU already exists.");
    }

    if (formErrors.length) {
      return renderVariantForm({
        req,
        res,
        mode: "edit",
        product: variant.productId,
        variant: { ...variant.toObject(), ...req.body, sku, attributes, images: nextImages },
        formErrors,
        statusCode: 400
      });
    }

    variant.sku = sku;
    variant.stock = Number(value.stock);
    variant.regularPrice = Number(value.regularPrice);
    variant.salePrice = value.salePrice === "" || value.salePrice == null ? undefined : Number(value.salePrice);
    variant.images = nextImages;
    variant.isActive = normalizeBoolean(value.isActive);
    variant.attributes = attributes;
    await variant.save();

    setFlash(req, "success", "Variant updated successfully.");
    res.redirect(`/admin/products/${variant.productId._id}/variants`);
  } catch (error) {
    console.error("Update variant error:", error);
    setFlash(req, "error", "Failed to update variant.");
    res.redirect("/admin/products");
  }
};

export const toggleVariantStatus = async (req, res) => {
  try {
    const variant = await Variant.findById(req.params.variantId);
    if (!variant) {
      return res.status(404).json({ success: false, message: "Variant not found." });
    }

    variant.isActive = !variant.isActive;
    await variant.save();

    return res.status(200).json({
      success: true,
      message: `Variant ${variant.isActive ? "activated" : "deactivated"} successfully.`
    });
  } catch (error) {
    console.error("Toggle variant status error:", error);
    return res.status(500).json({ success: false, message: "Failed to update variant status." });
  }
};
