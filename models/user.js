const mongoose = require('mongoose');
const loginSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true 
    },
    displayName: {
        type: String,
        default: function() { return this.name }
    },
    password: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: true
    },
    joinDate: {
        type: Date,
        default: Date.now
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    quizResults: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'QuizResult'
    }],
    totalQuizAttempts: {
        type: Number,
        default: 0
    },
    averageScore: {
        type: Number,
        default: 0
    }
});
const collection = new mongoose.model("users", loginSchema);
module.exports = collection;