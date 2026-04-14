const express = require('express');
const router = express.Router();
const Resource = require('../models/Resource');
const { protect } = require('../middleware/auth');
const resourceUpload = require('../middleware/resourceUpload');
const { cloudinary, uploadRawToCloudinary } = require('../config/cloudinary');

// @desc    Get all resources with filters
// @route   GET /api/resources
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { subject, semester, category, search } = req.query;
    let query = {};

    if (subject) query.subject = { $regex: subject, $options: 'i' };
    if (semester) query.semester = semester;
    if (category) query.category = category;
    
    if (search) {
      // Use text index search
      query.$text = { $search: search };
    }

    const resources = await Resource.find(query)
      .populate('uploader', 'name avatar role college')
      .sort({ createdAt: -1 });

    res.json(resources);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Upload a resource
// @route   POST /api/resources
// @access  Private
router.post('/', protect, resourceUpload.single('file'), async (req, res) => {
  try {
    const { title, description, subject, semester, category } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a file' });
    }

    // Upload file to Cloudinary for persistent storage
    const { url } = await uploadRawToCloudinary(
      req.file.buffer,
      req.file.originalname,
      'campusconnect/resources'
    );

    const resource = await Resource.create({
      title,
      description,
      subject,
      semester,
      category,
      file: url,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      uploader: req.user._id
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
