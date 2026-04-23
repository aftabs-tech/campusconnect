const express = require('express');
const Comment = require('../models/Comment');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');
const router = express.Router();

// @desc    Add a comment
// @route   POST /api/comments
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { postId, text } = req.body;

    if (!postId || !text) {
      return res.status(400).json({ message: 'Post ID and text are required' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = await Comment.create({
      postId,
      userId: req.user._id,
      text
    });

    const populatedComment = await Comment.findById(comment._id)
      .populate('userId', 'name avatar role')
      .populate('replies.userId', 'name avatar role');

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
          const io = req.app.get('io');
          io.to(post.author.toString()).emit('newNotification', notification);
          // Also emit to the post room for real-time comment updates
          io.to(postId.toString()).emit('newComment', populatedComment);
        }
      } catch (err) {
        console.error('Notification error:', err);
      }
    } else {
      // If author is the one commenting, still emit to the room (others need to see it)
      if (req.app.get('io')) {
        req.app.get('io').to(postId.toString()).emit('newComment', populatedComment);
      }
    }

    res.status(201).json(populatedComment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get comments for a post
// @route   GET /api/comments/:postId
// @access  Private
router.get('/:postId', protect, async (req, res) => {
  try {
    const comments = await Comment.find({ postId: req.params.postId })
      .populate('userId', 'name avatar role')
      .populate('replies.userId', 'name avatar role')
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete a comment
// @route   DELETE /api/comments/:commentId
// @access  Private
router.delete('/:commentId', protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check ownership
    if (comment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    await comment.deleteOne();
    res.json({ message: 'Comment removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Like/Unlike a comment (Optional Enhancement)
// @route   PUT /api/comments/:commentId/like
// @access  Private
router.put('/:commentId/like', protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    const isLiked = comment.likes.includes(req.user._id);

    if (isLiked) {
      comment.likes = comment.likes.filter(id => id.toString() !== req.user._id.toString());
    } else {
      comment.likes.push(req.user._id);
    }

    await comment.save();
    res.json(comment.likes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Add a reply to a comment
// @route   POST /api/comments/:commentId/reply
// @access  Private
router.post('/:commentId/reply', protect, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: 'Reply text is required' });

    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    const reply = {
      userId: req.user._id,
      text,
      createdAt: new Date()
    };

    comment.replies.push(reply);
    await comment.save();

    const populatedComment = await Comment.findById(comment._id)
      .populate('userId', 'name avatar role')
      .populate('replies.userId', 'name avatar role');

    res.status(201).json(populatedComment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
