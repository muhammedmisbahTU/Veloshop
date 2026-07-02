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
