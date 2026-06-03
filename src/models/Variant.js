import mongoose from "mongoose";

const variantSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    stock: {
      type: Number,
      required: true,
      default: 0
    },
    regularPrice: {
      type: Number,
      required: true
    },
    salePrice: {
      type: Number
    },
    images: [
      {
        type: String
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    },
    attributes: [
      {
        name: {
          type: String,
          required: true,
          trim: true
        },
        value: {
          type: String,
          required: true,
          trim: true
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Indexes
variantSchema.index({ productId: 1 });

const Variant = mongoose.model("Variant", variantSchema);
export default Variant;
