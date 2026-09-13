const cloudinary = require('cloudinary').v2;
const path = require('path');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const hasCloudinary = () => Boolean(
  process.env.CLOUDINARY_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
);

async function uploadFileToCloudinary(file, req) {
  if (!file) return null;
  if (hasCloudinary()) {
    const resourceType = file.mimetype.startsWith('video/') ? 'video' : 'image';
    return cloudinary.uploader.upload(file.path, { resource_type: resourceType });
  }
  const base = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
  return { secure_url: `${base}/uploads/${path.basename(file.path)}` };
}

module.exports = { uploadFileToCloudinary, hasCloudinary };
