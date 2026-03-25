const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true,
    maxlength: 500
  }
}, { timestamps: true });

const postSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Post content is required'],
    maxlength: 2000
  },
  image: {
    type: String,
    default: ''
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  reactions: {
    '❤️': [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    '🔥': [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    '😂': [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    '👏': [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    '😮': [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    '💡': [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  isPoll: {
    type: Boolean,
    default: false
  },
  pollData: {
    question: String,
    options: [{
      text: String,
      votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    }],
    expiresAt: Date
  },
  comments: [commentSchema]

}, {
  timestamps: true
});

// Text index for search
postSchema.index({ content: 'text' });

module.exports = mongoose.model('Post', postSchema);
