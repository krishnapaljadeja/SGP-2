const express = require('express');
const cookieParser = require('cookie-parser');
const QuizTitle = require("./models/title");
const Question = require("./models/question");

const app = express();
const port = 3000;

// Set up EJS
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public')); // Serve static files

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/add', (req, res) => {
    res.render('add');
});

// Create a new quiz
app.post('/created', async (req, res) => {
    const { title, que, time } = req.body;

    try {
        const existingQuiz = await QuizTitle.findOne({ title: title });

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
    const { quiz_title, question, option1, option2, option3, option4,correct_answer } = req.body;

    try {
        const newQuestion = await Question.create({
            question,
            options: [option1, option2, option3, option4,correct_answer]
        });

        await QuizTitle.findOneAndUpdate(
            { title: quiz_title },
            { $push: { questions: newQuestion._id } },  // Push only the ObjectId
            { new: true }
        );

        res.send(`<script>alert("Question added successfully!"); window.location.href = "/manage";</script>`);
    } catch (err) {
        console.error(err);
        res.send(`<script>alert("Error adding question."); window.location.href = "/manage";</script>`);
    }
});

// Manage Quizzes
app.get('/manageview', async (req, res) => {
    let allQuizzes = await QuizTitle.find();
    res.render('manageview', { users: allQuizzes });
});

// Fetch questions for a selected quiz
app.get('/api/questions/:quizId', async (req, res) => {
    console.log("hey");
    try {
        const quiz = await usermodel.findById(req.params.quizId).populate('questions');
        if (!quiz) return res.status(404).json({ error: "Quiz not found" });

        const formattedQuestions = quiz.questions.map(q => ({
            _id: q._id,
            question: q.question,
            options: q.options,
            correct_answer: q.options.length >= 5 ? q.options[4] : null // 5th option as correct
        }));

        res.json({ questions: formattedQuestions });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Manage Page
app.get('/manage', async (req, res) => {
    let allQuizzes = await QuizTitle.find();
    res.render('manage', { users: allQuizzes });
});

// Analytics Page
app.get('/analytics', (req, res) => {
    res.render('analytics');
});

// Start Server
app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
});
