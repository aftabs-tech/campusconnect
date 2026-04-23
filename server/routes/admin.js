const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Resource = require('../models/Resource');

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

// @desc    Get all stats (posts, comments, resources)
// @route   GET /api/admin/stats
router.get('/stats', adminProtect, async (req, res) => {
  try {
    const posts = await Post.find().populate('author', 'name').sort({ createdAt: -1 });
    const resources = await Resource.find().sort({ createdAt: -1 });
    res.json({ posts, resources });
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
    await Resource.findByIdAndDelete(req.params.id);
    res.json({ message: 'Resource deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
