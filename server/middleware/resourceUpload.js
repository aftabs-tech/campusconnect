const multer = require('multer');
const path = require('path');

// Use memory storage so files are kept as buffers for Cloudinary upload
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = /pdf|doc|docx|ppt|pptx|txt|zip|jpg|jpeg|png/;
  const extname = allowed.test(path.extname(file.originalname).toLowerCase());
  
  if (extname) {
    cb(null, true);
  } else {
    cb(new Error('File type not supported. Use PDF, Word, PPT, TXT, ZIP or Images.'), false);
  }
};

const resourceUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter
});

module.exports = resourceUpload;
