import Banner from "../models/Banner.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import Variant from "../models/Variant.js";

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

  const detailsByProductId = new Map();
  variants.forEach((v) => {
    const pid = v.productId.toString();
    const currentPrice = v.salePrice != null ? v.salePrice : v.regularPrice;
    if (!detailsByProductId.has(pid)) {
      detailsByProductId.set(pid, {
        images: v.images || [],
        minPrice: currentPrice,
        maxPrice: currentPrice,
        stock: v.stock
      });
    } else {
      const existing = detailsByProductId.get(pid);
      existing.minPrice = Math.min(existing.minPrice, currentPrice);
      existing.maxPrice = Math.max(existing.maxPrice, currentPrice);
      existing.stock += v.stock;
      if (!existing.images.length && v.images?.length) {
        existing.images = v.images;
      }
    }
  });

  return products.map((product) => {
    const details = detailsByProductId.get(product._id.toString()) || {
      images: [],
      minPrice: 0,
      maxPrice: 0,
      stock: 0
    };
    return {
      ...product.toObject(),
      displayImage: details.images[0] || "",
      minPrice: details.minPrice,
      maxPrice: details.maxPrice,
      stock: details.stock
    };
  });
};

export const getShop = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 9; // 9 items per page
    const sortOption = req.query.sort || "newest";

    // 1. Fetch active categories for filtering sidebar
    const categories = await Category.find({ isActive: true, isDeleted: false }).sort({ name: 1 });

    // 2. Build product base query
    const query = { status: "ACTIVE", isDeleted: false };

    // Apply category filter
    if (req.query.category) {
      const cat = await Category.findOne({ slug: req.query.category, isActive: true, isDeleted: false });
      if (cat) {
        query.categoryId = cat._id;
      }
    }

    // Apply search filter
    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { brand: { $regex: req.query.search, $options: "i" } },
        { description: { $regex: req.query.search, $options: "i" } }
      ];
    }

    // Fetch matching products
    const productDocs = await Product.find(query).populate("categoryId", "name slug");
    
    // Enrich with pricing and display image from active variants
    let enrichedProducts = await attachVariantDetails(productDocs);

    // Apply Price Filters on enriched prices
    const minPrice = parseFloat(req.query.minPrice);
    const maxPrice = parseFloat(req.query.maxPrice);
    if (!isNaN(minPrice)) {
      enrichedProducts = enrichedProducts.filter(p => p.minPrice >= minPrice);
    }
    if (!isNaN(maxPrice)) {
      enrichedProducts = enrichedProducts.filter(p => p.minPrice <= maxPrice);
    }

    // Apply Stock Filters
    if (req.query.stock === "in-stock") {
      enrichedProducts = enrichedProducts.filter(p => p.stock > 0);
    }

    // Sort enriched products
    if (sortOption === "price-low-to-high") {
      enrichedProducts.sort((a, b) => a.minPrice - b.minPrice);
    } else if (sortOption === "price-high-to-low") {
      enrichedProducts.sort((a, b) => b.minPrice - a.minPrice);
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
      selectedCategory: req.query.category || "",
      searchQuery: req.query.search || "",
      minPrice: req.query.minPrice || "",
      maxPrice: req.query.maxPrice || "",
      stockFilter: req.query.stock || "",
      sortOption,
      currentPage: page,
      totalPages,
      totalProducts
    });
  } catch (error) {
    console.error("Shop page error:", error);
    res.status(500).render("errors/500", {
      layout: "layouts/user-layout",
      title: "Server Error"
    });
  }
};
