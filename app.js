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

// Homepgeeee
app.get("/", async (req, res) => {
  try {
    const totalQuizzes = await QuizTitle.countDocuments(); 
    res.render("index", { totalQuizzes }); 
  } catch (error) {
    console.error("Error fetching quiz count:", error);
    res.render("index", { totalQuizzes: 0 }); 
  }
});

// Add Quiz Page
app.get('/add', (req, res) => res.render('add'));

//Analytics page demo
app.get('/analytics', (req, res) => res.render('analytics'));

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

router.get("/api/quiz-count", async (req, res) => {
  try {
    const totalQuizzes = await QuizTitle.countDocuments();
    res.json({ total: totalQuizzes });
  } catch (error) {
    console.error("Error fetching quiz count:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

// Add a question to a quiz
app.post('/submitque', async (req, res) => {
    const { quiz_title, question, option1, option2, option3, option4, correct_answer ,points} = req.body;

    if (!question || !correct_answer) {
        return res.send(`<script>alert("Error: Missing required fields!"); window.location.href = "/manage?quiz_title=${quiz_title}";</script>`);
    }

    try {
        const quiz = await QuizTitle.findOne({ title: quiz_title });

        if (!quiz) {
            return res.send(`<script>alert("Error: Quiz not found!"); window.location.href = "/manage?quiz_title=${quiz_title}";</script>`);
        }

        if (quiz.questions.length >= quiz.que) {
            return res.send(`<script>alert("Error: Maximum question limit reached!"); window.location.href = "/manage?quiz_title=${quiz_title}";</script>`);
        }

        // Check if any option already exists in the database
        const existingOptions = await Question.find({
            options: { $in: [option1, option2, option3, option4] }
        });

        // Compare the options after sorting them to avoid order issues
        const optionsArray = [option1, option2, option3, option4].sort();

        if (existingOptions.length > 0) {
            const duplicateQuestion = existingOptions.find(item => {
                const itemOptionsSorted = item.options.sort(); // Sort options for proper comparison
                return item.question === question && JSON.stringify(itemOptionsSorted) === JSON.stringify(optionsArray);
            });

            if (duplicateQuestion) {
                return res.send(`<script>alert("Error: The same question with the same options already exists!"); window.location.href = "/manage?quiz_title=${quiz_title}";</script>`);
            }
        }

        // Create the new question
        const newQuestion = await Question.create({
            question,
            options: [option1, option2, option3, option4],
            correct_answer,
            points
        });

        // Update the quiz with the new question
        await QuizTitle.findOneAndUpdate(
            { title: quiz_title },
            { $push: { questions: newQuestion._id } },
            { new: true }
        );
        res.send(`<script>alert("Question added successfully!"); window.location.href = "/manage?quiz_title=${quiz_title}";</script>`);
    } catch (err) {
        console.error("Error adding question:", err);
        res.send(`<script>alert("Error adding question."); window.location.href = "/manage?quiz_title=${quiz_title}";</script>`);
    }
});


// Manage Quizzes
app.get('/manageview', async (req, res) => {
    let allQuizzes = await QuizTitle.find();
    res.render('manageview', { users: allQuizzes });
});

// Display the list of questions
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
            correct_answer: q.correct_answer,
            points:q.points 
        }));

        res.json({ questions: formattedQuestions });
    } catch (error) {
        console.error("Error fetching questions:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a question
app.delete("/delete/:id", async (req, res) => {
    try {
        const questionId = req.params.id;
        const deletedQuestion = await Question.findByIdAndDelete(questionId);
        if (!deletedQuestion) {
            return res.status(404).json({ message: "Question not found" });
        }

        await QuizTitle.updateMany(
            { questions: questionId }, 
            { $pull: { questions: questionId } }
        );

        res.redirect("/manageview"); 
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Edit a question
app.get('/edit/:id', async (req, res) => {
    try {
        const question = await Question.findById(req.params.id);
        if (!question) {
            return res.status(404).send("Question not found");
        }
        res.render("edit", { question }); 
    } catch (error) {
        console.error("Error fetching question:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.put('/edit/:id', async (req, res) => {
    try {
        const { question, options, correct_answer } = req.body;
        const updatedQuestion = await Question.findByIdAndUpdate(
            req.params.id,
            { question, options, correct_answer },
            { new: true }
        );

        if (!updatedQuestion) {
            return res.status(404).json({ message: "Question not found" });
        }

        res.json({ message: "Question updated successfully!", updatedQuestion });
    } catch (error) {
        console.error("Error updating question:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
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
