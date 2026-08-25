import mongoose from "mongoose";
import Banner from "../models/Banner.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import Variant from "../models/Variant.js";
import wishlistService from "../services/wishlistService.js";
import {getBestOffer, getProductOffers} from "../services/offerService.js";
import { calculateOfferPrice } from "../services/priceService.js";

const attachVariantImages = async (products) => {
  const productIds = products.map((product) => product._id);
  const variants = await Variant.find({ productId: { $in: productIds }, isActive: true })
    .sort({ createdAt: 1 })
    .select("productId images");

  const imageByProductId = new Map();
  variants.forEach((variant) => {
    const productId = variant.productId.toString();
    if (!imageByProductId.has(productId) && variant.images?.length) {
      imageByProductId.set(productId, variant.images[0]);
    }
  });

  return products.map((product) => ({
    ...product.toObject(),
    displayImage: imageByProductId.get(product._id.toString()) || ""
  }));
};

export const getHome = async (req, res) => {
  try {
    const now = new Date();

    const [banners, categories, featuredProductDocs] = await Promise.all([
      Banner.find({
        status: "ACTIVE",
        $or: [
          { startDate: { $exists: false } },
          { startDate: null },
          { startDate: { $lte: now } }
        ],
        $and: [
          {
            $or: [
              { endDate: { $exists: false } },
              { endDate: null },
              { endDate: { $gte: now } }
            ]
          }
        ]
      })
        .sort({ createdAt: -1 })
        .limit(3),
      Category.find({ isActive: true, isDeleted: false }).sort({ createdAt: -1 }).limit(6),
      Product.find({ status: "ACTIVE", isDeleted: false, isFeatured: true })
        .populate("categoryId", "name slug")
        .sort({ createdAt: -1 })
        .limit(4)
    ]);
    const featuredProducts = await attachVariantImages(featuredProductDocs);

    res.render("user/home", {
      layout: "layouts/user-layout",
      title: "Veloshop - Premium Gaming Gear",
      banners,
      categories,
      featuredProducts
    });
  } catch (error) {
    console.error("Home page error:", error);
    res.render("user/home", {
      layout: "layouts/user-layout",
      title: "Veloshop - Premium Gaming Gear",
      banners: [],
      categories: [],
      featuredProducts: []
    });
  }
};

const attachVariantDetails = async (products) => {
  const productIds = products.map((p) => p._id);
  const variants = await Variant.find({ productId: { $in: productIds }, isActive: true });

  // Get active offers
  const now = new Date();
  const Offer = (await import("../models/Offer.js")).default;
  const activeOffers = await Offer.find({
    isActive: true,
    isDeleted: false,
    startDate: { $lte: now },
    expiryDate: { $gte: now }
  });

  const detailsByProductId = new Map();
  variants.forEach((v) => {
    const pid = v.productId.toString();
    const currentPrice = v.salePrice != null ? v.salePrice : v.regularPrice;
    if (!detailsByProductId.has(pid)) {
      detailsByProductId.set(pid, {
        images: v.images || [],
        minPrice: currentPrice,
        maxPrice: currentPrice,
        stock: v.stock,
        defaultVariantId: v._id
      });
    } else {
      const existing = detailsByProductId.get(pid);
      existing.minPrice = Math.min(existing.minPrice, currentPrice);
      existing.maxPrice = Math.max(existing.maxPrice, currentPrice);
      existing.stock += v.stock;
      if (!existing.images.length && v.images?.length) {
        existing.images = v.images;
      }
      if (!existing.defaultVariantId) {
        existing.defaultVariantId = v._id;
      }
    }
  });

  return products.map((productDoc) => {
    const product = productDoc.toObject ? productDoc.toObject() : productDoc;
    const pid = product._id.toString();
    const details = detailsByProductId.get(pid) || {
      images: [],
      minPrice: 0,
      maxPrice: 0,
      stock: 0,
      defaultVariantId: null
    };

    // Calculate product and category offers for the product
    const categoryIdStr = (product.categoryId?._id || product.categoryId || "").toString();

    const productOffersList = activeOffers.filter(
      offer => offer.type === "PRODUCT" && offer.product && offer.product.toString() === pid
    );
    const categoryOffersList = activeOffers.filter(
      offer => offer.type === "CATEGORY" && offer.category && offer.category.toString() === categoryIdStr
    );

    let productOffer = null;
    let productDiscount = 0;
    for (const offer of productOffersList) {
      const discount = offer.discountType === "PERCENTAGE" 
        ? (details.minPrice * offer.discountValue) / 100 
        : offer.discountValue;
      if (discount > productDiscount) {
        productDiscount = discount;
        productOffer = offer;
      }
    }

    let categoryOffer = null;
    let categoryDiscount = 0;
    for (const offer of categoryOffersList) {
      const discount = offer.discountType === "PERCENTAGE" 
        ? (details.minPrice * offer.discountValue) / 100 
        : offer.discountValue;
      if (discount > categoryDiscount) {
        categoryDiscount = discount;
        categoryOffer = offer;
      }
    }

    const appliedOffer = productDiscount >= categoryDiscount ? productOffer : categoryOffer;
    const appliedDiscountAmount = Math.max(productDiscount, categoryDiscount);

    return {
      ...product,
      displayImage: details.images[0] || "",
      originalMinPrice: details.minPrice,
      minPrice: Math.max(0, details.minPrice - appliedDiscountAmount),
      maxPrice: details.maxPrice,
      stock: details.stock,
      defaultVariantId: details.defaultVariantId,
      productOffer,
      categoryOffer,
      appliedOffer,
      offerDiscount: appliedDiscountAmount
    };
  });
};

const toArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
};

export const getShop = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 9; // 9 items per page
    const sortOption = req.query.sort || "newest";
    const selectedCategories = toArray(req.query.category);
    const selectedBrands = toArray(req.query.brand);

    // Fetch user wishlist if logged in
    const userId = req.session?.user?.id || req.user?._id;
    let wishlistedVariantIds = [];
    if (userId) {
      const wishlist = await wishlistService.getWishlist(userId);
      if (wishlist && wishlist.items) {
        wishlistedVariantIds = wishlist.items.map((item) =>
          item.variantId?._id ? item.variantId._id.toString() : item.variantId?.toString()
        );
      }
    }

    // 1. Fetch active categories and brands for filtering sidebar
    const [categories, brands] = await Promise.all([
      Category.find({ isActive: true, isDeleted: false }).sort({ name: 1 }),
      Product.distinct("brand", { status: "ACTIVE", isDeleted: false })
    ]);
    brands.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    // 2. Build product base query
    const query = { status: "ACTIVE", isDeleted: false };

    // Apply category filter
    if (selectedCategories.length) {
      const matchedCategories = await Category.find({
        slug: { $in: selectedCategories },
        isActive: true,
        isDeleted: false
      });
      if (matchedCategories.length) {
        query.categoryId = { $in: matchedCategories.map((cat) => cat._id) };
      }
    }

    // Apply brand filter
    if (selectedBrands.length) {
      query.brand = { $in: selectedBrands };
    }

    // Apply search filter
    const searchQuery = String(req.query.search || "").trim();
    if (searchQuery) {
      query.$or = [
        { name: { $regex: searchQuery, $options: "i" } },
        { brand: { $regex: searchQuery, $options: "i" } },
        { description: { $regex: searchQuery, $options: "i" } }
      ];
    }

    // Fetch matching products
    const productDocs = await Product.find(query).populate("categoryId", "name slug");
    
    // Enrich with pricing and display image from active variants
    let enrichedProducts = await attachVariantDetails(productDocs);

    // Apply price range filters on enriched prices
    const minPrice = parseFloat(req.query.minPrice);
    const maxPrice = parseFloat(req.query.maxPrice);
    if (!isNaN(minPrice)) {
      enrichedProducts = enrichedProducts.filter((p) => p.minPrice >= minPrice);
    }
    if (!isNaN(maxPrice)) {
      enrichedProducts = enrichedProducts.filter((p) => p.minPrice <= maxPrice);
    }

    // Apply stock filter
    if (req.query.stock === "in-stock") {
      enrichedProducts = enrichedProducts.filter((p) => p.stock > 0);
    }

    // Sort enriched products
    const nameCompare = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    if (sortOption === "price-low-to-high") {
      enrichedProducts.sort((a, b) => a.minPrice - b.minPrice);
    } else if (sortOption === "price-high-to-low") {
      enrichedProducts.sort((a, b) => b.minPrice - a.minPrice);
    } else if (sortOption === "name-a-z") {
      enrichedProducts.sort(nameCompare);
    } else if (sortOption === "name-z-a") {
      enrichedProducts.sort((a, b) => nameCompare(b, a));
    } else if (sortOption === "rating") {
      enrichedProducts.sort((a, b) => b.averageRating - a.averageRating);
    } else {
      // Default: Newest
      enrichedProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Paginate results
    const totalProducts = enrichedProducts.length;
    const totalPages = Math.ceil(totalProducts / limit);
    const paginatedProducts = enrichedProducts.slice((page - 1) * limit, page * limit);

    res.render("user/shop", {
      layout: "layouts/user-layout",
      title: "Shop - Veloshop",
      products: paginatedProducts,
      categories,
      brands,
      selectedCategories,
      selectedBrands,
      searchQuery,
      minPrice: req.query.minPrice || "",
      maxPrice: req.query.maxPrice || "",
      stockFilter: req.query.stock || "",
      sortOption,
      currentPage: page,
      totalPages,
      totalProducts,
      wishlistedVariantIds
    });
  } catch (error) {
    console.error("Shop page error:", error);
    res.status(500).render("errors/500", {
      layout: "layouts/user-layout",
      title: "Server Error"
    });
  }
};


export const getProductDetails = async (req, res) => {
  try {
    let product;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      product = await Product.findById(req.params.id).populate("categoryId");
    } else {
      product = await Product.findOne({ slug: req.params.id }).populate("categoryId");
    }

    if (!product || product.isDeleted || product.status !== "ACTIVE") {
      return res.redirect("/shop");
    }

    const variants = await Variant.find({
      productId: product._id,
      isActive: true,
    });

    if (!variants || variants.length === 0) {
      return res.redirect("/shop");
    }

    const defaultVariant = variants[0];
    const defaultPrice = defaultVariant.salePrice != null ? defaultVariant.salePrice : defaultVariant.regularPrice;
    
    // Get both product & category offers, and the best one
    const offersData = await getProductOffers(product, defaultPrice);
    const offer = offersData.bestOffer;

    const pricing = calculateOfferPrice(
      defaultVariant.salePrice || defaultVariant.regularPrice,
      offer
    );

    let defaultDiscount = null;
    if (defaultVariant.salePrice) {
      defaultDiscount = Math.round(
        ((defaultVariant.regularPrice - defaultVariant.salePrice) /
          defaultVariant.regularPrice) *
          100,
      );
    }

    const relatedProducts = await Product.find({
      categoryId: product.categoryId._id,
      _id: { $ne: product._id },
      status: "ACTIVE",
      isDeleted: false,
    }).limit(4).lean();

    for (const p of relatedProducts) {
      const variant = await Variant.findOne({
        productId: p._id,
        isActive: true,
      }).lean();

      p.variant = variant;
      if (variant) {
        const vPrice = variant.salePrice != null ? variant.salePrice : variant.regularPrice;
        const vOffers = await getProductOffers(p, vPrice);
        p.productOffer = vOffers.productOffer;
        p.categoryOffer = vOffers.categoryOffer;
        p.appliedOffer = vOffers.appliedOffer;
        
        let discountAmt = 0;
        if (vOffers.appliedOffer) {
          if (vOffers.appliedOffer.discountType === "PERCENTAGE") {
            discountAmt = (vPrice * vOffers.appliedOffer.discountValue) / 100;
          } else {
            discountAmt = vOffers.appliedOffer.discountValue;
          }
        }
        p.discountedPrice = Math.max(0, vPrice - discountAmt);
      }
    }

    const userId = req.session?.user?.id || req.user?._id;
    let isWishlisted = false;
    if (userId) {
      isWishlisted = await wishlistService.isWishlisted(
        userId,
        defaultVariant._id,
      );
    }

    res.render("user/product-details", {
      title: "Product Details",
      product,
      variants,
      defaultVariant,
      defaultDiscount,
      relatedProducts,
      isWishlisted,
      productOffer: offersData.productOffer,
      categoryOffer: offersData.categoryOffer,
      offer,
      pricing
    });
  
  } catch (error) {
    console.error("Product detail page error:", error);
    res.redirect("/shop");
  }
};