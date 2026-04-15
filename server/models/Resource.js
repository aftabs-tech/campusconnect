const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 1000,
    default: ''
  },
  file: {
    type: String,
    required: [true, 'File is required']
  },
  fileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    default: 0
  },
  subject: {
    type: String,
    required: [true, 'Subject is required']
  },
  year: {
    type: Number,
    required: [true, 'Year is required']
  },
  course: {
    type: String,
    required: [true, 'Course is required']
  },
  semester: {
    type: Number,
    min: 1,
    max: 8,
    default: 1
  },
  category: {
    type: String,
    enum: ['notes', 'paper', 'assignment', 'book', 'other'],
    default: 'notes'
  },
  uploader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  downloads: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

resourceSchema.index({ subject: 'text', title: 'text' });

module.exports = mongoose.model('Resource', resourceSchema);
