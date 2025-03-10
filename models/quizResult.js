const mongoose = require('mongoose');

const quizResultSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
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
    completedAt: {
        type: Date,
        default: Date.now
    },
    userName: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('QuizResult', quizResultSchema);
