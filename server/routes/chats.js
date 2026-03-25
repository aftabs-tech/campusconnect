const express = require('express');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');
const router = express.Router();

// POST /api/chats — create or access a 1-on-1 chat
router.post('/', protect, async (req, res) => {
  try {
    const { userId } = req.body;
    const User = require('../models/User');

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const me = await User.findById(req.user._id);
    if (!me.connections.includes(userId)) {
      return res.status(403).json({ message: 'You can only chat with your connections' });
    }

    // Check if chat already exists
    let chat = await Chat.findOne({
      participants: { $all: [req.user._id, userId], $size: 2 }
    })
      .populate('participants', 'name avatar role college')
      .populate('latestMessage');

    if (chat) {
      return res.json(chat);
    }

    // Create new chat
    chat = await Chat.create({
      participants: [req.user._id, userId]
    });

    const fullChat = await Chat.findById(chat._id)
      .populate('participants', 'name avatar role college');

    res.status(201).json(fullChat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/chats/group — create group chat
router.post('/group', protect, async (req, res) => {
  try {
    const { name, users } = req.body;

    if (!name || !users || users.length < 2) {
      return res.status(400).json({ message: 'Group name and at least 2 other users are required' });
    }

    const participants = [...users, req.user._id];

    const groupChat = await Chat.create({
      groupName: name,
      participants,
      isGroup: true,
      groupAdmin: req.user._id
    });

    const fullGroupChat = await Chat.findById(groupChat._id)
      .populate('participants', 'name avatar role college')
      .populate('groupAdmin', 'name avatar role');

    res.status(201).json(fullGroupChat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/chats/group/:id/rename — rename group
router.put('/group/:id/rename', protect, async (req, res) => {
  try {
    const { name } = req.body;
    const chat = await Chat.findById(req.params.id);

    if (!chat || !chat.isGroup) {
      return res.status(404).json({ message: 'Group chat not found' });
    }

    if (chat.groupAdmin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only admins can rename the group' });
    }

    chat.groupName = name;
    await chat.save();
    
    const updated = await Chat.findById(chat._id)
      .populate('participants', 'name avatar role college')
      .populate('groupAdmin', 'name avatar role');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/chats/group/:id/add — add member
router.put('/group/:id/add', protect, async (req, res) => {
  try {
    const { userId } = req.body;
    const chat = await Chat.findById(req.params.id);

    if (!chat || !chat.isGroup) {
      return res.status(404).json({ message: 'Group chat not found' });
    }

    if (chat.groupAdmin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only admins can add members' });
    }

    if (chat.participants.includes(userId)) {
      return res.status(400).json({ message: 'User already in group' });
    }

    chat.participants.push(userId);
    await chat.save();

    const updated = await Chat.findById(chat._id)
      .populate('participants', 'name avatar role college')
      .populate('groupAdmin', 'name avatar role');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/chats/group/:id/remove — remove member
router.put('/group/:id/remove', protect, async (req, res) => {
  try {
    const { userId } = req.body;
    const chat = await Chat.findById(req.params.id);

    if (!chat || !chat.isGroup) {
      return res.status(404).json({ message: 'Group chat not found' });
    }

    if (chat.groupAdmin.toString() !== req.user._id.toString() && userId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    chat.participants = chat.participants.filter(p => p.toString() !== userId);
    await chat.save();

    const updated = await Chat.findById(chat._id)
      .populate('participants', 'name avatar role college')
      .populate('groupAdmin', 'name avatar role');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/chats — list user's chats
router.get('/', protect, async (req, res) => {
  try {
    const User = require('../models/User');
    const me = await User.findById(req.user._id);

    const chats = await Chat.find({
      participants: req.user._id
    })
      .populate('participants', 'name avatar role college connections')
      .populate('latestMessage')
      .sort({ updatedAt: -1 });

    // Filter chats: only keep those that are groups or where the other user is a connection
    const filteredChats = chats.filter(chat => {
      if (chat.isGroup) return true;
      const otherUser = chat.participants.find(p => p._id.toString() !== req.user._id.toString());
      if (!otherUser) return false;
      // Also check if I am in other user's connections
      return me.connections.some(cid => cid.toString() === otherUser._id.toString());
    });

    res.json(filteredChats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/chats/:chatId/messages — get messages for a chat
router.get('/:chatId/messages', protect, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not a participant of this chat' });
    }

    const messages = await Message.find({ chat: req.params.chatId })
      .populate('sender', 'name avatar role')
      .sort({ createdAt: 1 });

    // Mark all messages from other users as read
    await Message.updateMany(
      {
        chat: req.params.chatId,
        sender: { $ne: req.user._id },
        readBy: { $nin: [req.user._id] }
      },
      { $addToSet: { readBy: req.user._id } }
    );

    // Emit read event
    if (req.app.get('io')) {
      req.app.get('io').to(req.params.chatId).emit('messagesRead', {
        chatId: req.params.chatId,
        userId: req.user._id
      });
    }

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/chats/:chatId/messages — send a message
router.post('/:chatId/messages', protect, async (req, res) => {
  try {
    const { content } = req.body;

    const chat = await Chat.findById(req.params.chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    const message = await Message.create({
      chat: req.params.chatId,
      sender: req.user._id,
      content,
      readBy: [req.user._id] // Sender has already "read" it
    });

    // Update latest message on chat
    chat.latestMessage = message._id;
    await chat.save();

    const populated = await message.populate('sender', 'name avatar role');

    // Emit socket event if io is available
    if (req.app.get('io')) {
      req.app.get('io').to(req.params.chatId).emit('newMessage', populated);
      
      // Notify other participants
      const otherParticipants = chat.participants.filter(p => p.toString() !== req.user._id.toString());
      for (const recipientId of otherParticipants) {
        try {
          const notification = await Notification.create({
            recipient: recipientId,
            sender: req.user._id,
            type: 'message',
            message: `New message from ${req.user.name}`,
            link: `/chat?chat=${chat._id}`
          });
          req.app.get('io').to(recipientId.toString()).emit('newNotification', notification);
        } catch (err) {
          console.error('Notification error:', err);
        }
      }
    }

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/chats/:chatId/read — mark messages as read
router.put('/:chatId/read', protect, async (req, res) => {
  try {
    await Message.updateMany(
      {
        chat: req.params.chatId,
        sender: { $ne: req.user._id },
        readBy: { $nin: [req.user._id] }
      },
      { $addToSet: { readBy: req.user._id } }
    );

    // Emit read event
    if (req.app.get('io')) {
      req.app.get('io').to(req.params.chatId).emit('messagesRead', {
        chatId: req.params.chatId,
        userId: req.user._id
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
