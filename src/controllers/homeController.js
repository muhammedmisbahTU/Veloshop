import Banner from "../models/Banner.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";

export const getHome = async (req, res) => {
  try {
    const now = new Date();

    const [banners, categories, featuredProducts] = await Promise.all([
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
