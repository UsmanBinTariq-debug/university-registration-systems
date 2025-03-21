const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
    code: { type: String, unique: true, required: true },
    title: { type: String, required: true },
    department: { type: String, required: true },
    level: { type: Number, required: true },
    schedule: {
        days: { type: [String], required: true },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true }
    },
    seats: { type: Number, required: true },
    prerequisites: { type: [String], default: [] }
});

courseSchema.virtual('hasUnmetPrerequisites').get(function () {
    return this.prerequisites.length > 0;
});

module.exports = mongoose.model('Course', courseSchema);
