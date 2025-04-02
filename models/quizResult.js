const mongoose = require('mongoose');

const quizResultSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    quiz: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'QuizTitle',
        required: true
    },
    score: {
        type: Number,
        required: true
    },
    totalPossibleScore: {
        type: Number,
        required: true
    },
    percentage: {
        type: Number,
        required: true
    },
    userName: {
        type: String,
        required: true
    },
    timeTaken: {
        type: Number,
        default: 0
    },
    timeLimit: {
        type: Number,
        required: true
    },
    completedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('QuizResult', quizResultSchema);
