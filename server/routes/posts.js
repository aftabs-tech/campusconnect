const express = require('express');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const router = express.Router();

// GET /api/posts — paginated feed with search
router.get('/', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { search } = req.query;

    let filter = {};
    if (search) {
      filter.content = { $regex: search, $options: 'i' };
    }

    const posts = await Post.find(filter)
      .populate('author', 'name avatar role college')
      .populate('comments.user', 'name avatar role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments(filter);

    res.json({
      posts,
      page,
      pages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/posts/user/:userId — get posts by a specific user
router.get('/user/:userId', protect, async (req, res) => {
  try {
    const posts = await Post.find({ author: req.params.userId })
      .populate('author', 'name avatar role college')
      .populate('comments.user', 'name avatar role')
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/posts — create post (with optional image or poll)
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    console.log('Post creation request body:', req.body);
    const { content, isPoll, pollQuestion, pollOptions, pollExpiresAt } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : '';

    const isPollActive = isPoll === 'true' || isPoll === true;
    let pollData = null;

    if (isPollActive && pollOptions) {
      try {
        const optionsArray = typeof pollOptions === 'string' ? JSON.parse(pollOptions) : pollOptions;
        if (Array.isArray(optionsArray) && optionsArray.length >= 2) {
          pollData = {
            question: pollQuestion || content,
            options: optionsArray.map(opt => ({ text: opt, votes: [] })),
            expiresAt: pollExpiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          };
        }
      } catch (e) {
        console.error('Poll options parse error:', e);
      }
    }

    const post = await Post.create({
      author: req.user._id,
      content,
      image,
      isPoll: isPollActive && !!pollData,
      pollData
    });

    const populated = await post.populate('author', 'name avatar role college');
    res.status(201).json(populated);
  } catch (error) {
    console.error('Post creation error:', error);
    res.status(500).json({ message: error.message });
  }
});



// PUT /api/posts/:id/like — toggle like (backward compat)
router.put('/:id/like', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const isLiked = post.likes.includes(req.user._id);

    if (isLiked) {
      post.likes = post.likes.filter(id => id.toString() !== req.user._id.toString());
    } else {
      post.likes.push(req.user._id);
    }

    await post.save();
    res.json({ likes: post.likes, liked: !isLiked });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/posts/:id/react — toggle emoji reaction
router.put('/:id/react', protect, async (req, res) => {
  try {
    const { emoji } = req.body;
    const validEmojis = ['❤️', '🔥', '😂', '👏', '😮', '💡'];

    if (!validEmojis.includes(emoji)) {
      return res.status(400).json({ message: 'Invalid reaction emoji' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Initialize reactions if needed
    if (!post.reactions) {
      post.reactions = {};
    }
    if (!post.reactions[emoji]) {
      post.reactions[emoji] = [];
    }

    const userId = req.user._id.toString();

    // Remove user from ALL other reactions first (one reaction per user)
    for (const e of validEmojis) {
      if (!post.reactions[e]) post.reactions[e] = [];
      post.reactions[e] = post.reactions[e].filter(id => id.toString() !== userId);
    }

    // Check if user already had this emoji
    const hadReaction = post.reactions[emoji].some(id => id.toString() === userId);

    if (!hadReaction) {
      post.reactions[emoji].push(req.user._id);

      // Create notification for post author
      if (post.author.toString() !== req.user._id.toString()) {
        try {
          const notification = await Notification.create({
            recipient: post.author,
            sender: req.user._id,
            type: 'reaction',
            message: `${req.user.name} reacted with ${emoji} to your post`,
            postId: post._id,
            link: `/feed?post=${post._id}`
          });
          
          if (req.app.get('io')) {
            req.app.get('io').to(post.author.toString()).emit('newNotification', notification);
          }
        } catch (err) {
          console.error('Notification error:', err);
        }
      }
    }

    post.markModified('reactions');
    await post.save();
    res.json({ reactions: post.reactions, toggled: !hadReaction, emoji });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/posts/:id/comments — add comment
router.post('/:id/comments', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    post.comments.push({
      user: req.user._id,
      text: req.body.text
    });

    await post.save();

    // Create notification for post author
    if (post.author.toString() !== req.user._id.toString()) {
      try {
        const notification = await Notification.create({
          recipient: post.author,
          sender: req.user._id,
          type: 'comment',
          message: `${req.user.name} commented on your post`,
          postId: post._id,
          link: `/feed?post=${post._id}`
        });
        
        if (req.app.get('io')) {
          req.app.get('io').to(post.author.toString()).emit('newNotification', notification);
        }
      } catch (err) {
        console.error('Notification error:', err);
      }
    }

    const freshPost = await Post.findById(req.params.id)
      .populate('comments.user', 'name avatar role');

    res.status(201).json(freshPost.comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Vote in a poll
// @route   PUT /api/posts/:id/vote
// @access  Private
router.put('/:id/vote', protect, async (req, res) => {
  try {
    const { optionIndex } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post || !post.isPoll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    if (post.pollData.expiresAt && new Date() > new Date(post.pollData.expiresAt)) {
      return res.status(400).json({ message: 'Poll has expired' });
    }

    // Find if and where the user already voted
    let previousOptionIndex = -1;
    post.pollData.options.forEach((opt, idx) => {
      if (opt.votes.some(id => id.toString() === req.user._id.toString())) {
        previousOptionIndex = idx;
      }
    });

    if (optionIndex < 0 || optionIndex >= post.pollData.options.length) {
      return res.status(400).json({ message: 'Invalid option index' });
    }

    // If already voted
    if (previousOptionIndex !== -1) {
      // Remove previous vote
      post.pollData.options[previousOptionIndex].votes = post.pollData.options[previousOptionIndex].votes.filter(
        id => id.toString() !== req.user._id.toString()
      );

      // If they clicked a DIFFERENT option, add the new vote
      // If they clicked the SAME option, they just unvoted
      if (previousOptionIndex !== optionIndex) {
        post.pollData.options[optionIndex].votes.push(req.user._id);
      }
    } else {
      // First time voting
      post.pollData.options[optionIndex].votes.push(req.user._id);
    }

    post.markModified('pollData');
    await post.save();

    res.json(post.pollData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/posts/:id — delete own post
router.delete('/:id', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    await post.deleteOne();
    res.json({ message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/posts/:id/save — toggle bookmark
router.post('/:id/save', protect, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.savedPosts) user.savedPosts = [];

    const isSaved = user.savedPosts.includes(req.params.id);

    if (isSaved) {
      user.savedPosts = user.savedPosts.filter(pid => pid.toString() !== req.params.id);
    } else {
      user.savedPosts.push(req.params.id);
    }

    await user.save();
    res.json(user.savedPosts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/posts/saved — get all saved posts
router.get('/saved', protect, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user._id).populate({
      path: 'savedPosts',
      populate: [
        { path: 'author', select: 'name avatar role college' },
        { path: 'comments.user', select: 'name avatar role' }
      ]
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Reverse the saved posts to show the most recently saved first
    const saved = [...user.savedPosts].reverse();
    res.json(saved);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

