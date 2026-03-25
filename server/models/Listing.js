const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: 1000
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: 0
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Books', 'Cycles', 'Lab Kits', 'Electronics', 'Others'],
    default: 'Others'
  },
  images: [{
    type: String,
    required: true
  }],
  condition: {
    type: String,
    enum: ['New', 'Used - Like New', 'Used - Good', 'Used - Fair'],
    default: 'Used - Good'
  },
  status: {
    type: String,
    enum: ['Available', 'Sold', 'Archived'],
    default: 'Available'
  }
}, {
  timestamps: true
});

// Text index for search
listingSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Listing', listingSchema);
