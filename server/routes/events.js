const express = require('express');
const Event = require('../models/Event');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const router = express.Router();

// GET /api/events — list events
router.get('/', protect, async (req, res) => {
  try {
    const { category, college } = req.query;
    let filter = {};

    if (category && category !== 'all') {
      filter.category = category;
    }
    if (college) {
      filter.college = { $regex: college, $options: 'i' };
    }

    const events = await Event.find(filter)
      .populate('organizer', 'name avatar role college')
      .sort({ date: 1 });

    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/events — create event (with optional image upload)
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    const { title, description, date, location, college, category } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : '';

    const event = await Event.create({
      organizer: req.user._id,
      title,
      description,
      date,
      location,
      college: college || req.user.college,
      image,
      category: category || 'other'
    });

    const populated = await event.populate('organizer', 'name avatar role college');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/events/:id/attend — toggle attendance
router.put('/:id/attend', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const isAttending = event.attendees.includes(req.user._id);

    if (isAttending) {
      event.attendees = event.attendees.filter(id => id.toString() !== req.user._id.toString());
    } else {
      event.attendees.push(req.user._id);
    }

    await event.save();
    res.json({ attending: !isAttending, attendees: event.attendees });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/events/:id — delete own event
router.delete('/:id', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this event' });
    }

    await event.deleteOne();
    res.json({ message: 'Event deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
