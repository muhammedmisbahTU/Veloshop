import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import { faker } from "@faker-js/faker";
import bcrypt from "bcrypt";

import User from "../models/User.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import Variant from "../models/Variant.js";

dotenv.config();

const seedAll = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`Connected to MongoDB: ${process.env.MONGODB_URI}`);

    // Clean existing data
    await User.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    await Variant.deleteMany({});

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
    for (let i = 0; i < 5; i++) {
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
      { name: "Road Bikes", slug: "road-bikes" },
      { name: "Mountain Bikes", slug: "mountain-bikes" },
      { name: "Hybrid Bikes", slug: "hybrid-bikes" },
      { name: "Accessories", slug: "accessories" },
      { name: "Apparel", slug: "apparel" },
    ];
    
    const categories = await Category.insertMany(categoriesData);
    console.log(`Seeded ${categories.length} categories.`);

    // Seed Products & Variants
    for (const category of categories) {
      // Create 3 products per category
      for (let i = 0; i < 3; i++) {
        const productName = faker.commerce.productName();
        const product = await Product.create({
          name: productName,
          slug: faker.helpers.slugify(productName).toLowerCase(),
          description: faker.commerce.productDescription(),
          brand: faker.company.name(),
          categoryId: category._id,
          tags: [faker.word.adjective(), faker.word.noun()]
        });

        // Create 2 variants per product
        for (let j = 0; j < 2; j++) {
          const isSale = faker.datatype.boolean();
          const regularPrice = parseFloat(faker.commerce.price({ min: 100, max: 2000 }));
          
          await Variant.create({
            productId: product._id,
            sku: faker.string.alphanumeric(8).toUpperCase(),
            stock: faker.number.int({ min: 10, max: 100 }),
            regularPrice: regularPrice,
            salePrice: isSale ? regularPrice * 0.8 : undefined,
            images: [faker.image.urlLoremFlickr({ category: 'bicycle' })],
            attributes: [
              { name: "Color", value: faker.color.human() },
              { name: "Size", value: faker.helpers.arrayElement(["S", "M", "L", "XL"]) }
            ]
          });
        }
      }
    }
    console.log("Seeded products and variants.");

    console.log("Database seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
};

seedAll();
