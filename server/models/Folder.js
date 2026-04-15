const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  year: {
    type: String,
    required: [true, 'Year is required'],
    trim: true
  },
  course: {
    type: String,
    required: [true, 'Course is required'],
    trim: true
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true
  }
}, {
  timestamps: true
});

// Ensure combination (year + course + subject) is unique
folderSchema.index({ year: 1, course: 1, subject: 1 }, { unique: true });

module.exports = mongoose.model('Folder', folderSchema);
