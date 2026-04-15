const express = require('express');
const router = express.Router();
const https = require('https');
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
    const { folderId, search, category, semester } = req.query;
    let query = {};

    // 1. Strict mapping: if folderId is provided, show only those resources
    if (folderId) {
      query.folder = folderId;
    } else {
      // Default view: Limit to user's year and below
      query.year = { $lte: req.user.year };
    }

    if (category) query.category = category;
    if (semester) query.semester = semester;
    
    if (search) {
      query.$text = { $search: search };
    }

    console.log(`Fetching resources with query:`, JSON.stringify(query));
    const resources = await Resource.find(query)
      .populate('uploader', 'name avatar role college')
      .sort({ createdAt: -1 });
    
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
    console.log(`Uploading resource ${req.file.originalname} to 'resources' folder...`);
    const { url, secure_url } = await uploadRawToCloudinary(
      req.file.buffer,
      req.file.originalname,
      'resources'
    );
    
    const storageUrl = secure_url || url;
    console.log(`Resource uploaded successfully: ${storageUrl}`);

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
        subject: subject.trim(),
        semester: Number(semester) || 1,
        createdBy: req.user._id
      });
    }

    // 4. Create local Resource record referencing the folder
    // Enforce data consistency: The folder is the source of truth
    const resource = await Resource.create({
      title,
      description,
      subject: folder.subject,
      year: Number(folder.year),
      course: folder.course,
      semester: Number(folder.semester), // Force semester from folder, ignore request body
      category,
      file: storageUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      uploader: req.user._id,
      folder: folder._id
    });

    console.log(`Resource saved to DB: ${resource.title} (ID: ${resource._id}) in Folder: ${folder.subject}`);

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

// @desc    Download resource file (Proxy to bypass cloud restrictions)
// @route   GET /api/resources/:id/download-file
// @access  Private
router.get('/:id/download-file', protect, async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) return res.status(404).json({ message: 'Resource not found' });

    let fileUrl = resource.file;
    // Replace any transformation flags which might cause 401s on backend
    if (fileUrl.includes('?fl_attachment')) {
      fileUrl = fileUrl.split('?')[0];
    }

    https.get(fileUrl, (remoteRes) => {
      if (remoteRes.statusCode >= 400) {
        return res.status(remoteRes.statusCode).json({ message: 'Cloud storage rejected the request' });
      }

      let fileName = String(resource.title || 'resource').replace(/[^a-zA-Z0-9.\-_ ]/g, '_');
      if (fileUrl.toLowerCase().endsWith('.pdf') && !fileName.toLowerCase().endsWith('.pdf')) {
        fileName += '.pdf';
      }

      res.setHeader('Content-Type', remoteRes.headers['content-type'] || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      remoteRes.pipe(res);
    }).on('error', (err) => {
      console.error('Proxy download error:', err);
      res.status(500).json({ message: 'Failed to stream the file' });
    });
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

// @desc    Delete a folder and all its resources
// @route   DELETE /api/resources/folders/:id
// @access  Private
router.delete('/folders/:id', protect, async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    // Check if user is the creator or admin
    if (String(folder.createdBy) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this folder' });
    }

    // Cascade delete all resources in this folder
    await Resource.deleteMany({ folder: folder._id });
    await folder.deleteOne();

    res.json({ message: 'Folder and all its resources deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
