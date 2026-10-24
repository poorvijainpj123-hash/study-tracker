const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  kind: { type: String, enum: ['course', 'subject', 'project'], default: 'course' },
  status: { type: String, enum: ['not-started', 'in-progress', 'paused', 'done'], default: 'not-started' },
  leftOffAt: { type: String, default: '' },
  links: [{ label: String, url: String }],
  lastTouched: { type: Date, default: Date.now },
});

const milestoneSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
  title: { type: String, required: true, trim: true },
  done: { type: Boolean, default: false },
  note: { type: String, default: '' },
  order: { type: Number, default: 0 },
});

module.exports = {
  Item: mongoose.model('Item', itemSchema),
  Milestone: mongoose.model('Milestone', milestoneSchema),
};
