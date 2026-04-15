const express = require('express');
const router = express.Router();
const Resource = require('../models/Resource');
const Folder = require('../models/Folder');
const { protect } = require('../middleware/auth');
const resourceUpload = require('../middleware/resourceUpload');
const { cloudinary, uploadRawToCloudinary } = require('../config/cloudinary');

// @desc    Get all resources with filters
// @route   GET /api/resources
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { subject, semester, category, search, folderId } = req.query;
    let query = {};

    if (folderId) query.folder = folderId;
    if (subject) query.subject = { $regex: subject, $options: 'i' };
    if (semester) query.semester = semester;
    if (category) query.category = category;
    
    // Access control: User can see resources from their year and below
    query.year = { $lte: req.user.year };
    
    if (search) {
      // Use text index search
      query.$text = { $search: search };
    }

    res.json(resources);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get all allowed folders
// @route   GET /api/resources/folders
// @access  Private
router.get('/folders', protect, async (req, res) => {
  try {
    const folders = await Folder.find({ year: { $lte: req.user.year } })
      .sort({ year: 1, course: 1 });
    res.json(folders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Upload a resource
// @route   POST /api/resources
// @access  Private
router.post('/', protect, resourceUpload.single('file'), async (req, res) => {
  try {
    const { title, description, subject, year, course, semester, category, folderId } = req.body;
    
    // Validation
    if (!title || !subject || !year || !course || !semester) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if user is uploading to their own year
    if (Number(year) !== req.user.year) {
      return res.status(403).json({ message: `You can only upload resources for your own year (Year ${req.user.year})` });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a file' });
    }

    // 1. File Size Validation (10MB)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (req.file.size > MAX_SIZE) {
      return res.status(400).json({ message: 'File size should be less than 10MB' });
    }

    // 2. Upload file to Cloudinary first
    console.log(`Uploading file ${req.file.originalname} to Cloudinary...`);
    const { url, secure_url } = await uploadRawToCloudinary(
      req.file.buffer,
      req.file.originalname,
      'campusconnect/resources'
    );
    
    const storageUrl = secure_url || url;

    // 3. Find or Create Folder only if upload was successful
    let folder;
    if (folderId) {
      folder = await Folder.findById(folderId);
    } 
    
    if (!folder) {
      folder = await Folder.findOne({ 
        year: Number(year), 
        course: course.trim(), 
        subject: subject.trim() 
      });
    }
    
    if (!folder) {
      folder = await Folder.create({ 
        year: Number(year), 
        course: course.trim(), 
        subject: subject.trim() 
      });
    }

    // 4. Create local Resource record referencing the folder
    const resource = await Resource.create({
      title,
      description,
      subject: folder.subject,
      year: folder.year,
      course: folder.course,
      semester,
      category,
      file: storageUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      uploader: req.user._id,
      folder: folder._id
    });

    const populated = await resource.populate('uploader', 'name avatar role college');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Increment download count
// @route   PATCH /api/resources/:id/download
// @access  Private
router.patch('/:id/download', protect, async (req, res) => {
  try {
    const resource = await Resource.findByIdAndUpdate(
      req.params.id,
      { $inc: { downloads: 1 } },
      { new: true }
    );
    if (!resource) return res.status(404).json({ message: 'Resource not found' });
    res.json({ downloads: resource.downloads });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete a resource
// @route   DELETE /api/resources/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) return res.status(404).json({ message: 'Resource not found' });

    // Check if user is uploader or admin (assuming role might be 'admin')
    if (resource.uploader.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this resource' });
    }

    await resource.deleteOne();
    res.json({ message: 'Resource deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
