const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const QuizTitle = require("./models/title");
const Question = require("./models/question");

const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// Homepage
app.get('/', (req, res) => res.render('index'));

// Add Quiz Page
app.get('/add', (req, res) => res.render('add'));

// Create a new quiz
app.post('/created', async (req, res) => {
    const { title, que, time } = req.body;

    try {
        const existingQuiz = await QuizTitle.findOne({ title });

        if (existingQuiz) {
            return res.send(`<script>alert("Quiz already exists!"); window.location.href = "/";</script>`);
        }

        await QuizTitle.create({ title, que, time });
        res.send(`<script>alert("Quiz successfully created!"); window.location.href = "/";</script>`);
    } catch (err) {
        console.error(err);
        res.send(`<script>alert("Error creating quiz."); window.location.href = "/";</script>`);
    }
});

// Add a question to a quiz
app.post('/submitque', async (req, res) => {

    const { quiz_title, question, option1, option2, option3, option4, correct_answer } = req.body;

    if (!question || !correct_answer) {
        return res.send(`<script>alert("Error: Missing required fields!"); window.location.href = "/manage";</script>`);
    }

    try {
        const newQuestion = await Question.create({
            question,
            options: [option1, option2, option3, option4],
            correct_answer
        });

      

        await QuizTitle.findOneAndUpdate(
            { title: quiz_title },
            { $push: { questions: newQuestion._id } },
            { new: true }
        );

        res.send(`<script>alert("Question added successfully!"); window.location.href = "/manage";</script>`);
    } catch (err) {
        console.error("Error adding question:", err);
        res.send(`<script>alert("Error adding question."); window.location.href = "/manage";</script>`);
    }
});

// Manage Quizzes
app.get('/manageview', async (req, res) => {
    let allQuizzes = await QuizTitle.find();
    res.render('manageview', { users: allQuizzes });
});



// displays the list of question
app.get('/api/questions/:quizId', async (req, res) => {
    try {
        const { quizId } = req.params;

      
        if (!mongoose.Types.ObjectId.isValid(quizId)) {
            console.error("Invalid Quiz ID:", quizId);
        }

        
        const quiz = await QuizTitle.findById(quizId).populate('questions');

        if (!quiz) {
            console.error("Quiz not found", quizId);
        }

        const formattedQuestions = quiz.questions.map(q => ({
            _id: q._id,
            question: q.question,
            options: q.options,
            correct_answer: q.correct_answer
        }));

        res.json({ questions: formattedQuestions });
    } catch (error) {
        console.error("Error fetching questions:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//delete the question
app.delete("/delete/:id", async (req, res) => {
      const questionId = req.params.id;
      const result = await Question.findByIdAndDelete({_id:questionId});
      res.redirect("/manageview");
  });
  
// Manage Page
app.get('/manage', async (req, res) => {
    let allQuizzes = await QuizTitle.find();
    res.render('manage', { users: allQuizzes });
});

// Start Server
app.listen(port, () => {
    console.log(` Server running on http://localhost:${port}`);
});
