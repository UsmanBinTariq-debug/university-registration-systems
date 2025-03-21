const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    rollNumber: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    registeredCourses: { type: [String], default: [] },
    completedPrerequisites: { type: [String], default: [] }
});

module.exports = mongoose.model('Student', studentSchema);
