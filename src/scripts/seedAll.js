import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import { faker } from "@faker-js/faker";
import bcrypt from "bcrypt";

import User from "../models/User.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import Variant from "../models/Variant.js";
import Order from "../models/Order.js";
import Offer from "../models/Offer.js";
import Cart from "../models/Cart.js";
import Wishlist from "../models/Wishlist.js";
import Address from "../models/Address.js";
import Coupon from "../models/Coupon.js";

dotenv.config();

const seedAll = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`Connected to MongoDB: ${process.env.MONGODB_URI}`);

    // Clean all existing data to prevent orphaned references
    console.log("Cleaning database...");
    await User.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    await Variant.deleteMany({});
    await Order.deleteMany({});
    await Offer.deleteMany({});
    await Cart.deleteMany({});
    await Wishlist.deleteMany({});
    await Address.deleteMany({});
    await Coupon.deleteMany({});

    console.log("Cleared existing data.");

    // Seed Users
    const hashedPassword = await bcrypt.hash("password123", 10);
    const users = [];

    // Create an Admin user
    const admin = await User.create({
      fullName: "Admin User",
      email: "admin@veloshop.com",
      password: hashedPassword,
      role: "ADMIN",
      isEmailVerified: true
    });
    users.push(admin);

    // Create regular users
    for (let i = 0; i < 10; i++) {
      const user = await User.create({
        fullName: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        password: hashedPassword,
        isEmailVerified: true
      });
      users.push(user);
    }
    console.log(`Seeded ${users.length} users.`);

    // Seed Categories
    const categoriesData = [
      { name: "Gaming Keyboards", slug: "gaming-keyboards" },
      { name: "Gaming Mice", slug: "gaming-mice" },
      { name: "Mousepads", slug: "mousepads" },
      { name: "Headsets", slug: "headsets" }
    ];

    const categories = await Category.insertMany(categoriesData);
    console.log(`Seeded ${categories.length} categories.`);

    // Seed Products & Variants
    const keyboardCat = categories.find(c => c.name === "Gaming Keyboards");
    const mouseCat = categories.find(c => c.name === "Gaming Mice");

    const productsData = [
      { name: "Razer BlackWidow V3", brand: "Razer", cat: keyboardCat, desc: "Mechanical Gaming Keyboard with Green Switches." },
      { name: "Logitech G Pro X", brand: "Logitech", cat: keyboardCat, desc: "Tenkeyless mechanical gaming keyboard." },
      { name: "Corsair K70 RGB", brand: "Corsair", cat: keyboardCat, desc: "Mechanical keyboard with Cherry MX Speed." },
      { name: "Logitech G502 Hero", brand: "Logitech", cat: mouseCat, desc: "High performance gaming mouse with 25K sensor." },
      { name: "Razer DeathAdder V2", brand: "Razer", cat: mouseCat, desc: "Ergonomic wired gaming mouse." },
      { name: "SteelSeries Rival 3", brand: "SteelSeries", cat: mouseCat, desc: "Wired gaming mouse with true tracking." }
    ];

    const allVariants = [];
    for (const p of productsData) {
      const product = await Product.create({
        name: p.name,
        slug: faker.helpers.slugify(p.name).toLowerCase(),
        description: p.desc,
        brand: p.brand,
        categoryId: p.cat._id,
        tags: ["gaming", "esports", "RGB"]
      });

      const colors = [
        { name: "Black", bg: "1a1a1a", fg: "ffffff" },
        { name: "White", bg: "f5f5f5", fg: "1a1a1a" }
      ];

      // Create variants
      for (const color of colors) {
        const regularPrice = parseFloat(faker.commerce.price({ min: 3000, max: 15000 }));

        let variantImages = [];

        if (p.cat.name === "Gaming Keyboards") {
          if (color.name === "Black") {
            variantImages = [
              "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef",
              "https://images.unsplash.com/photo-1574012716378-0ca6f4c18c08",
              "https://images.unsplash.com/photo-1635987391914-cb84b567e68f"
            ];
          } else {
            variantImages = [
              "https://images.unsplash.com/photo-1587829741301-dc798b83add3",
              "https://images.unsplash.com/photo-1541140532154-b024d705b90a",
              "https://plus.unsplash.com/premium_photo-1683543124615-fb42e42c6201"
            ];
          }
        } else {
          // Mice
          if (color.name === "Black") {
            variantImages = [
              "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46",
              "https://images.unsplash.com/photo-1605773527852-c546a8584ea3",
              "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7"
            ];
          } else {
            variantImages = [
              "https://images.unsplash.com/photo-1754820978711-611479056f97",
              "https://images.unsplash.com/photo-1755373255602-c030aac3bc69",
              "https://images.unsplash.com/photo-1527814050087-3793815479db"
            ];
          }
        }

        const variant = await Variant.create({
          productId: product._id,
          sku: faker.string.alphanumeric(8).toUpperCase(),
          stock: faker.number.int({ min: 20, max: 200 }),
          regularPrice: regularPrice,
          salePrice: regularPrice * 0.9,
          images: variantImages,
          attributes: [
            { name: "Color", value: color.name }
          ]
        });
        allVariants.push({ variant, product });
      }
    }
    console.log("Seeded products and variants.");

    // Seed Orders
    const statuses = ["DELIVERED", "CONFIRMED", "PROCESSING", "SHIPPED"];
    let orderCount = 0;

    for (let i = 0; i < 30; i++) {
      const user = faker.helpers.arrayElement(users.slice(1)); // Pick a regular user
      const orderItems = [];
      let grandTotal = 0;

      // Pick 1-3 random variants
      const itemsCount = faker.number.int({ min: 1, max: 3 });
      for (let k = 0; k < itemsCount; k++) {
        const item = faker.helpers.arrayElement(allVariants);
        const qty = faker.number.int({ min: 1, max: 2 });
        const price = item.variant.salePrice || item.variant.regularPrice;

        orderItems.push({
          variantId: item.variant._id,
          sku: item.variant.sku,
          productName: item.product.name,
          thumbnail: item.variant.images[0],
          quantity: qty,
          price: price,
          itemStatus: "ACTIVE"
        });
        grandTotal += price * qty;
      }

      await Order.create({
        orderNumber: "ORD" + faker.string.numeric(8),
        userId: user._id,
        items: orderItems,
        paymentMethod: faker.helpers.arrayElement(["ONLINE", "COD"]),
        paymentStatus: "SUCCESS",
        status: faker.helpers.arrayElement(statuses),
        subtotal: grandTotal,
        grandTotal: grandTotal,
        addressSnapshot: {
          addressLine1: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state(),
          pinCode: faker.location.zipCode(),
          country: "India"
        },
        createdAt: faker.date.recent({ days: 60 }) // Distribute over last 2 months for charts
      });
      orderCount++;
    }

    console.log(`Seeded ${orderCount} orders.`);

    // Seed Coupons
    await Coupon.create([
      {
        code: "WELCOME50",
        description: "Get 50% off on your first purchase!",
        discountType: "PERCENTAGE",
        discountValue: 50,
        minimumPurchase: 300,
        maximumDiscount: 150,
        startDate: new Date(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        usageLimit: null,
        usagePerUser: 1,
        applicableTo: "ALL",
        isActive: true
      },
      {
        code: "VELO500",
        description: "Flat ₹500 off on purchases above ₹2000",
        discountType: "FIXED",
        discountValue: 500,
        minimumPurchase: 2000,
        startDate: new Date(),
        expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        usageLimit: 100,
        usagePerUser: 1,
        applicableTo: "ALL",
        isActive: true
      },
      {
        code: "VELO10",
        description: "10% off on all products",
        discountType: "PERCENTAGE",
        discountValue: 10,
        minimumPurchase: 500,
        maximumDiscount: 500,
        startDate: new Date(),
        expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        usageLimit: null,
        usagePerUser: 5,
        applicableTo: "ALL",
        isActive: true
      }
    ]);
    console.log("Seeded coupons.");

    console.log("Database seeded successfully with eCommerce PC gear data!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
};

seedAll();
