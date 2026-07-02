import cloudinaryModule from "cloudinary";
import pkg from "multer-storage-cloudinary";
import multer from "multer";
import "dotenv/config";

const CloudinaryStorage = pkg.CloudinaryStorage || pkg;
const cloudinary = cloudinaryModule.v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Strictly allowed formats
const ALLOWED_FORMATS = ["jpg", "png", "jpeg", "webp"];

// Gateway filter to reject invalid types before cloud upload
const fileFilter = (req, file, cb) => {
  const fileExtension = file.mimetype.split("/")[1];
  if (ALLOWED_FORMATS.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(
      new Error(`Invalid file format. Allowed: ${ALLOWED_FORMATS.join(", ")}`),
      false,
    );
  }
};

// Dynamic storage builder
const createStorage = (folderName) => {
  return new CloudinaryStorage({
    cloudinary: cloudinaryModule,
    params: {
      folder: folderName,
      allowed_formats: ALLOWED_FORMATS,
      transformation: [{ width: 500, height: 500, crop: "limit" }],
    },
  });
};

// Middleware exports with localized rules
export const uploadAvatar = multer({
  storage: createStorage("ecommerce/avatars"),
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

export const uploadProduct = multer({
  storage: createStorage("ecommerce/products"),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

export const uploadVariantImages = multer({
  storage: createStorage("ecommerce/variants"),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per image
});
