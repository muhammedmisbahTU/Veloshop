


import connectDB from '../config/db.js';
import dotenv from 'dotenv';

import mongoose from "mongoose";
import Offer from "../models/Offer.js";
import Product from "../models/Product.js";
import Category from "../models/Category.js";

dotenv.config();
connectDB()

const seedOffers = async () => {

    try {

        await mongoose.connect(process.env.MONGODB_URI);

        console.log("MongoDB connected");

        // Remove old offers
        await Offer.deleteMany({});


        // Find existing data
        const keyboard = await Product.findOne({
            name: /keyboard/i
        });

        const mouse = await Product.findOne({
            name: /mouse/i
        });

        const gamingCategory = await Category.findOne({
            name: /gaming/i
        });



        if (!keyboard || !mouse) {

            throw new Error(
                "Create products first: keyboard and mouse"
            );

        }



        await Offer.create({

            title: "Keyboard 10% Discount",

            type: "PRODUCT",

            product: keyboard._id,

            discountType: "PERCENTAGE",

            discountValue: 10,

            startDate: new Date(),

            expiryDate: new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000
            ),

            status: "ACTIVE"

        });



        await Offer.create({

            title: "Mouse ₹500 Discount",

            type: "PRODUCT",

            product: mouse._id,

            discountType: "FIXED",

            discountValue: 500,

            startDate: new Date(),

            expiryDate: new Date(
                Date.now() + 10 * 24 * 60 * 60 * 1000
            ),

            status: "ACTIVE"

        });



        if (gamingCategory) {

            await Offer.create({

                title: "Gaming Accessories Sale",

                type: "CATEGORY",

                category: gamingCategory._id,

                discountType: "PERCENTAGE",

                discountValue: 20,

                startDate: new Date(),

                expiryDate: new Date(
                    Date.now() + 15 * 24 * 60 * 60 * 1000
                ),

                status: "ACTIVE"

            });

        }



        await Offer.create({

            title: "Expired Offer Test",

            type: "PRODUCT",

            product: keyboard._id,

            discountType: "PERCENTAGE",

            discountValue: 50,

            startDate: new Date(
                Date.now() - 20 * 24 * 60 * 60 * 1000
            ),

            expiryDate: new Date(
                Date.now() - 10 * 24 * 60 * 60 * 1000
            ),

            status: "EXPIRED"

        });



        await Offer.create({

            title: "Future Sale",

            type: "PRODUCT",

            product: keyboard._id,

            discountType: "PERCENTAGE",

            discountValue: 30,

            startDate: new Date(
                Date.now() + 5 * 24 * 60 * 60 * 1000
            ),

            expiryDate: new Date(
                Date.now() + 15 * 24 * 60 * 60 * 1000
            ),

            status: "UPCOMING"

        });



        await Offer.create({

            title: "Referral ₹100 Discount",

            type: "REFERRAL",

            referralCode: "VELO100",

            discountType: "FIXED",

            discountValue: 100,

            startDate: new Date(),

            expiryDate: new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000
            ),

            status: "ACTIVE"

        });



        console.log("Offer seed completed");


        process.exit(0);


    } catch (error) {

        console.error(error);

        process.exit(1);

    }

};


seedOffers();