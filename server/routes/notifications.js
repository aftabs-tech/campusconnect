const express = require('express');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');
const router = express.Router();

// GET /api/notifications — list user's notifications (newest first)
router.get('/', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('sender', 'name avatar role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      read: false
    });

    res.json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper to emit unread count update via socket
const emitUnreadCount = async (req, userId) => {
  try {
    const io = req.app.get('io');
    if (io) {
      const unreadCount = await Notification.countDocuments({
        recipient: userId,
        read: false
      });
      io.to(userId.toString()).emit('unreadCountUpdate', unreadCount);
    }
  } catch (err) {
    console.error('Socket emit error:', err);
  }
};

// PUT /api/notifications/:id/read — mark one as read
router.put('/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    emitUnreadCount(req, req.user._id);
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/notifications/read-post/:postId — mark all relevant notifications for a post as read
router.put('/read-post/:postId', protect, async (req, res) => {
  try {
    const postId = req.params.postId;
    await Notification.updateMany(
      {
        recipient: req.user._id,
        postId,
        read: false
      },
      { read: true }
    );
    emitUnreadCount(req, req.user._id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/notifications/read-chat/:chatId — mark all message notifications for a specific chat as read
router.put('/read-chat/:chatId', protect, async (req, res) => {
  try {
    const chatId = req.params.chatId;
    await Notification.updateMany(
      {
        recipient: req.user._id,
        type: 'message',
        read: false,
        link: { $regex: chatId }
      },
      { read: true }
    );
    emitUnreadCount(req, req.user._id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/notifications/read-all — mark all as read
router.put('/read-all', protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { read: true }
    );
    emitUnreadCount(req, req.user._id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
