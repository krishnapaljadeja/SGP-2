const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const QuizTitle = require("./models/title");
const Question = require("./models/question");
const router = express.Router();

const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));



app.get('/', async (req, res) => {
    try {
        let allQuizzes = await QuizTitle.find().populate('questions'); // Populate questions

        // Filter quizzes where que matches the actual number of questions
        let validQuizzes = allQuizzes.filter(quiz => quiz.questions.length === quiz.que);

        res.render('user', { users: validQuizzes }); // Send only valid quizzes
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});



app.get('/quiz/:id', async (req, res) => {
   
    try {
        const quiz = await QuizTitle.findById(req.params.id).populate('questions');
        if (!quiz) {
            console.log("Quiz not found in the database.");
            return res.status(404).send('Quiz not found');
        }
        
        res.render('startQuiz', { quiz });  
    } catch (error) {
        console.error("Error fetching quiz:", error);
        res.status(500).send("Error loading quiz");
    }
});



app.post("/startQuiz", async (req, res) => {
    try {
        const { quizId, answers } = req.body;
        const quiz = await QuizTitle.findById(quizId).populate('questions');

        if (!quiz) {
            return res.status(404).send("Quiz not found.");
        }

        let totalScore = 0;
        let correctAnswers = {};

        // Process each question
        quiz.questions.forEach((q) => {
            correctAnswers[q._id] = q.correct_answer;
            if (answers && answers[q._id] && answers[q._id] === q.correct_answer) {
                totalScore += q.points;
            }
        });

        // Ensure total possible points
        const totalPossiblePoints = quiz.questions.reduce((sum, q) => sum + q.points, 0);

        // Render quiz results
        res.render('quizResult', { quiz, totalScore, totalPossiblePoints });
        
    } catch (error) {
        console.error("Error processing quiz:", error);
        res.status(500).send("Error processing quiz.");
    }
});


app.listen(port, () => {
    console.log(` Server running on http://localhost:${port}`);
});
