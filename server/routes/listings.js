const express = require('express');
const Listing = require('../models/Listing');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const router = express.Router();

// GET /api/listings — Get all listings with filters
router.get('/', protect, async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, status } = req.query;
    let filter = {};

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (status) {
      filter.status = status;
    } else {
      filter.status = 'Available';
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    const listings = await Listing.find(filter)
      .populate('seller', 'name avatar role college')
      .sort({ createdAt: -1 });

    res.json(listings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/listings/:id — Get single listing
router.get('/:id', protect, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id)
      .populate('seller', 'name avatar role college email');
    
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }
    
    res.json(listing);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/listings — Create new listing (Multiple images)
router.post('/', protect, upload.array('images', 5), async (req, res) => {
  try {
    const { title, description, price, category, condition } = req.body;
    const images = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

    if (images.length === 0) {
      return res.status(400).json({ message: 'At least one image is required' });
    }

    const listing = await Listing.create({
      seller: req.user._id,
      title,
      description,
      price: Number(price),
      category,
      condition,
      images
    });

    const populated = await listing.populate('seller', 'name avatar role college');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/listings/:id/status — Update status (Sold/Available)
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    if (listing.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    listing.status = req.body.status;
    await listing.save();
    res.json(listing);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/listings/:id — Delete listing
router.delete('/:id', protect, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    if (listing.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await listing.deleteOne();
    res.json({ message: 'Listing removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
