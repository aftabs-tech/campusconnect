const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const streamifier = require('streamifier');

/**
 * Upload a file buffer to Cloudinary (images)
 * @param {Buffer} fileBuffer - The file buffer from multer memoryStorage
 * @param {string} folder - The Cloudinary folder to upload to (e.g. 'avatars', 'events')
 * @returns {Promise<string>} - The secure URL of the uploaded image
 */
const uploadToCloudinary = (fileBuffer, folder = 'campusconnect') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [
          { width: 1200, crop: 'limit' },
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result.secure_url);
        }
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
};

/**
 * Upload a raw file (PDF, DOC, etc.) to Cloudinary
 * @param {Buffer} fileBuffer - The file buffer from multer memoryStorage
 * @param {string} originalName - Original filename for proper naming
 * @param {string} folder - The Cloudinary folder
 * @returns {Promise<{url: string, publicId: string}>} - The secure URL and public ID
 */
const uploadRawToCloudinary = (fileBuffer, originalName, folder = 'resources') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'raw', // Force raw for all document types (PDF, DOC, etc.)
        public_id: `${Date.now()}-${originalName}`
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            url: result.secure_url,
            publicId: result.public_id
          });
        }
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
};

module.exports = { cloudinary, uploadToCloudinary, uploadRawToCloudinary };
