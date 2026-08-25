import connectDB from '../config/db.js';
import dotenv from 'dotenv';
import mongoose from "mongoose";
import Coupon from "../models/Coupon.js";

dotenv.config();
connectDB();

const seedCoupons = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("MongoDB connected");

        // Remove old coupons
        await Coupon.deleteMany({});
        console.log("Cleared existing coupons.");

        // 1. Welcome Coupon (Percentage)
        await Coupon.create({
            code: "WELCOME50",
            description: "Get 50% off on your first purchase!",
            discountType: "PERCENTAGE",
            discountValue: 50,
            minimumPurchase: 300,
            maximumDiscount: 150,
            startDate: new Date(),
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            usageLimit: null,
            usagePerUser: 1,
            applicableTo: "ALL",
            isActive: true
        });

        // 2. Fixed Discount Coupon
        await Coupon.create({
            code: "VELO500",
            description: "Flat ₹500 off on purchases above ₹2000",
            discountType: "FIXED",
            discountValue: 500,
            minimumPurchase: 2000,
            startDate: new Date(),
            expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days
            usageLimit: 100,
            usagePerUser: 1,
            applicableTo: "ALL",
            isActive: true
        });

        // 3. Regular 10% Off
        await Coupon.create({
            code: "VELO10",
            description: "10% off on all products",
            discountType: "PERCENTAGE",
            discountValue: 10,
            minimumPurchase: 500,
            maximumDiscount: 500,
            startDate: new Date(),
            expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
            usageLimit: null,
            usagePerUser: 5,
            applicableTo: "ALL",
            isActive: true
        });

        // 4. Expired Coupon
        await Coupon.create({
            code: "EXPIRED30",
            description: "30% off (Expired)",
            discountType: "PERCENTAGE",
            discountValue: 30,
            minimumPurchase: 100,
            startDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
            expiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            usageLimit: null,
            applicableTo: "ALL",
            isActive: false
        });

        console.log("Coupon seed completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("Error seeding coupons:", error);
        process.exit(1);
    }
};

seedCoupons();
