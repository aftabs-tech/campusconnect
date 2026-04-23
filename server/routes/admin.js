const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Resource = require('../models/Resource');
const Event = require('../models/Event');
const Folder = require('../models/Folder');
const { cloudinary } = require('../config/cloudinary');

// Admin Middleware: Checks x-admin-secret header
const adminProtect = (req, res, next) => {
  const secret = req.headers['x-admin-secret'];
  if (secret && secret === process.env.ADMIN_SECRET) {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden: Admin access only' });
  }
};

// @desc    Verify admin secret
// @route   POST /api/admin/verify
// @access  Private (Hidden)
router.post('/verify', (req, res) => {
  const { secret } = req.body;
  if (secret && secret === process.env.ADMIN_SECRET) {
    res.json({ success: true });
  } else {
    res.status(403).json({ success: false, message: 'Invalid admin secret' });
  }
});

// @desc    Get all users
// @route   GET /api/admin/users
router.get('/users', adminProtect, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get all stats (posts, comments, resources, events, folders)
// @route   GET /api/admin/stats
router.get('/stats', adminProtect, async (req, res) => {
  try {
    const posts = await Post.find().populate('author', 'name').sort({ createdAt: -1 });
    const resources = await Resource.find().populate('uploader', 'name').sort({ createdAt: -1 });
    const events = await Event.find().populate('organizer', 'name').sort({ createdAt: -1 });
    const folders = await Folder.find().sort({ createdAt: -1 });
    res.json({ posts, resources, events, folders });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete a user
router.delete('/users/:id', adminProtect, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete a post
router.delete('/posts/:id', adminProtect, async (req, res) => {
  try {
    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete a comment
router.delete('/comments/:id', adminProtect, async (req, res) => {
  try {
    await Comment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete a resource
router.delete('/resources/:id', adminProtect, async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (resource && resource.publicId) {
      await cloudinary.uploader.destroy(resource.publicId, { resource_type: 'raw' }).catch(e => console.error('Cloudinary delete error:', e));
    }
    await Resource.findByIdAndDelete(req.params.id);
    res.json({ message: 'Resource deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete an event
router.delete('/events/:id', adminProtect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (event && event.image) {
      // Extract publicId if possible or just try to delete if stored.
      // Usually images are deleted by extracting ID from URL. 
      // For simplicity, we just delete model unless we have specific publicId field.
    }
    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: 'Event deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete a folder (Cascade delete resources)
router.delete('/folders/:id', adminProtect, async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    // 1. Find all resources in this folder
    const resources = await Resource.find({ folderId: folder._id });

    // 2. Delete from Cloudinary
    for (const resrc of resources) {
      if (resrc.publicId) {
        // Resources can be PDFs (image type in my config) or raw
        const type = resrc.fileUrl.endsWith('.pdf') ? 'image' : 'raw';
        await cloudinary.uploader.destroy(resrc.publicId, { resource_type: type }).catch(() => {});
      }
    }

    // 3. Delete resources from DB
    await Resource.deleteMany({ folderId: folder._id });

    // 4. Delete folder
    await Folder.findByIdAndDelete(req.params.id);

    res.json({ message: 'Folder and all its resources deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
