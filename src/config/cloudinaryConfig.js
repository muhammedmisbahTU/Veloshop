import cloudinaryModule from "cloudinary";
import pkg from "multer-storage-cloudinary";
import multer from "multer";
import sharp from "sharp";
import { Readable } from "stream";
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

const variantMemoryUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per image
});

const uploadBufferToCloudinary = (buffer, folderName) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderName,
        resource_type: "image",
        format: "webp",
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      }
    );

    Readable.from(buffer).pipe(uploadStream);
  });
};

const processVariantImages = async (req, res, next) => {
  try {
    if (!req.files?.length) {
      return next();
    }

    const processedFiles = await Promise.all(
      req.files.map(async (file) => {
        const processedBuffer = await sharp(file.buffer)
          .rotate()
          .resize({
            width: 1000,
            height: 1000,
            fit: "cover",
            position: "centre",
          })
          .webp({ quality: 86 })
          .toBuffer();

        const uploaded = await uploadBufferToCloudinary(processedBuffer, "ecommerce/variants");

        return {
          ...file,
          buffer: undefined,
          path: uploaded.secure_url,
          url: uploaded.secure_url,
          secure_url: uploaded.secure_url,
          filename: uploaded.public_id,
          size: processedBuffer.length,
          mimetype: "image/webp",
        };
      })
    );

    req.files = processedFiles;
    next();
  } catch (error) {
    next(error);
  }
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

export const uploadVariantImages = {
  array: (fieldName, maxCount) => [
    variantMemoryUpload.array(fieldName, maxCount),
    processVariantImages,
  ],
};
