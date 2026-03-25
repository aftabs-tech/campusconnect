const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const router = express.Router();

// GET /api/users/me — get own profile
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('connections', 'name avatar role college');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/users/me — update own profile (with optional avatar upload)
router.put('/me', protect, upload.single('avatar'), async (req, res) => {
  try {
    const { name, bio, year, skills, college } = req.body;
    const user = await User.findById(req.user._id);

    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (req.file) user.avatar = `/uploads/${req.file.filename}`;
    if (year) user.year = year;
    if (skills) {
      user.skills = typeof skills === 'string' ? JSON.parse(skills) : skills;
    }
    if (college) user.college = college;

    const updated = await user.save();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/users — browse users (filter by role)
router.get('/', protect, async (req, res) => {
  try {
    const { role, search } = req.query;
    let filter = { _id: { $ne: req.user._id } };

    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { college: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('name avatar role college connections sentRequests incomingRequests')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/users/:id — view another user's profile
router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('connections', 'name avatar role college');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/users/:id/connect — send connection request
router.post('/:id/connect', protect, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot connect with yourself' });
    }

    const user = await User.findById(req.user._id);
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Initialize arrays if they don't exist
    if (!user.sentRequests) user.sentRequests = [];
    if (!targetUser.incomingRequests) targetUser.incomingRequests = [];

    // Check if already connected (use string comparison for reliability)
    const alreadyConnected = user.connections.some(c => c.toString() === req.params.id);
    if (alreadyConnected) {
      return res.status(400).json({ message: 'Already connected' });
    }

    // Check if request already sent
    const requestAlreadySent = user.sentRequests.some(r => r.toString() === req.params.id);
    if (requestAlreadySent) {
      return res.status(400).json({ message: 'Request already sent' });
    }

    targetUser.incomingRequests.push(req.user._id);
    user.sentRequests.push(req.params.id);

    await targetUser.save();
    await user.save();

    // Create notification for targetUser
    try {
      const Notification = require('../models/Notification');
      const notification = await Notification.create({
        recipient: targetUser._id,
        sender: req.user._id,
        type: 'connection_request',
        message: `${req.user.name} sent you a connection request`,
        link: `/profile/${req.user._id}`
      });

      if (req.app.get('io')) {
        req.app.get('io').to(targetUser._id.toString()).emit('newNotification', notification);
      }
    } catch (err) {
      console.error('Notification error:', err);
    }

    res.json({ message: 'Request sent' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/users/:id/accept-request — accept connection request
router.put('/:id/accept-request', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    // Ensure the request exists in incomingRequests
    const hasIncoming = user.incomingRequests?.some(id => id.toString() === req.params.id);
    if (!hasIncoming) {
      return res.status(400).json({ message: 'No request from this user' });
    }

    // Move from incoming to connections
    user.incomingRequests = user.incomingRequests.filter(id => id.toString() !== req.params.id);
    user.connections.push(req.params.id);

    // Update targetUser (remove from sentRequests, add to connections)
    targetUser.sentRequests = targetUser.sentRequests.filter(id => id.toString() !== req.user._id.toString());
    targetUser.connections.push(req.user._id);

    await user.save();
    await targetUser.save();

    // Create notification for targetUser (now A)
    try {
      const Notification = require('../models/Notification');
      const notification = await Notification.create({
        recipient: targetUser._id,
        sender: req.user._id,
        type: 'connection_accept',
        message: `${req.user.name} accepted your connection request`,
        link: `/profile/${req.user._id}`
      });

      if (req.app.get('io')) {
        req.app.get('io').to(targetUser._id.toString()).emit('newNotification', notification);
      }
    } catch (err) {
      console.error('Notification error:', err);
    }

    res.json({ message: 'Connected' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/users/:id/reject-request — reject connection request
router.put('/:id/reject-request', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    user.incomingRequests = user.incomingRequests.filter(id => id.toString() !== req.params.id);
    targetUser.sentRequests = targetUser.sentRequests.filter(id => id.toString() !== req.user._id.toString());

    await user.save();
    await targetUser.save();

    res.json({ message: 'Request rejected' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/users/:id/disconnect — remove connection
router.delete('/:id/disconnect', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    user.connections = user.connections.filter(id => id.toString() !== req.params.id);
    targetUser.connections = targetUser.connections.filter(id => id.toString() !== req.user._id.toString());

    await user.save();
    await targetUser.save();

    res.json({ message: 'Disconnected' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/users/:id/cancel-request — cancel sent request
router.delete('/:id/cancel-request', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    user.sentRequests = user.sentRequests.filter(id => id.toString() !== req.params.id);
    targetUser.incomingRequests = targetUser.incomingRequests.filter(id => id.toString() !== req.user._id.toString());

    await user.save();
    await targetUser.save();

    res.json({ message: 'Request cancelled' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
