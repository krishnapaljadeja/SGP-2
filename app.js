const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const QuizTitle = require("./models/title");
const jwt = require("jsonwebtoken")
const Question = require("./models/question");
const title = require('./models/title');
const collection = require('./models/user')
const transporter = require("./otp");
const verifyToken = require("./middlewares/authmiddleware")
const trackActivity = require('./middlewares/activityMiddleware');
const dotenv = require("dotenv").config();
const bcrypt = require("bcrypt");
const QuizResult = require('./models/quizResult');
const moment = require('moment');

const app = express();
const port = 5000;

const tempUserStore = new Map(); // Temporary store for user details
const otpStore = new Map();

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

app.use(trackActivity);

////////////////////////////////////////////////////////////////////////////////////////

// app.get("/home", (req, res) => {
//     res.render("home");
// });

// Home Route
app.get("/", (req, res) => {
    res.render("login");
});

//logout route
app.post("/logout", (req, res) => {
    res.clearCookie("token")
    res.render("login");
});

// Signup Route (GET)
app.get("/signup", (req, res) => {
    res.render("signup");
});

// OTP Route (GET)
app.get("/otp", (req, res) => {
    res.render("otp");
});

// Signup Route (POST)
app.post("/signup", async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const existingUser = await collection.findOne({ name: username });
        const existingEmail = await collection.findOne({ email });

        if (existingUser || existingEmail) {
            return res.send(`<script>alert("User already exists."); window.location.href = "/";</script>`);
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore.set(email, { otp, expiresAt: Date.now() + 2 * 60 * 1000 });
        tempUserStore.set(email, { username, email, password });

        const mailOptions = {
            from: "digitalworld2511@gmail.com",
            to: email,
            subject: "Your OTP for Signup",
            text: `Your OTP for signup is: ${otp}. It expires in 2 minutes.`,
        };

        await transporter.sendMail(mailOptions);
        res.redirect("/otp");
    } catch (error) {
        console.error("Error during signup:", error);
        res.status(500).send("Error during signup");
    }
});

// OTP Verification Route
app.post("/otp", async (req, res) => {
    try {
        const { otp } = req.body;
        let emailFound = null;
        for (const [email, otpData] of otpStore.entries()) {
            if (otpData.otp === otp && Date.now() <= otpData.expiresAt) {
                emailFound = email;
                break;
            }
        }

        if (!emailFound) {
            return res.status(400).send("Invalid or expired OTP.");
        }

        const tempUser = tempUserStore.get(emailFound);
        if (!tempUser) {
            return res.status(400).send("User data not found. Please restart signup.");
        }

        const hashedPassword = await bcrypt.hash(tempUser.password, 10);
        const newUser = new collection({ name: tempUser.username, password: hashedPassword, email: tempUser.email, role: "student" });
        await newUser.save();

        otpStore.delete(emailFound);
        tempUserStore.delete(emailFound);

        res.send(`<script>alert("Signup successful! You can now log in."); window.location.href = "/";</script>`);
    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).send("Error verifying OTP");
    }
});

// Login Route
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await collection.findOne({ $or: [{ name: username }, { email: username }] });

        if (!user) {
            return res.send(`<script>alert("User not found"); window.location.href = "/";</script>`);
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (isPasswordMatch) {
            const token = jwt.sign(
                {
                    id: user._id,
                    role: user.role,
                    name: user.name,
                    email: user.email
                },
                process.env.ACCESS_TOKEN_SECRET_KEY
            );

            res.cookie("token", token, { httpOnly: true, secure: false });

            if (user.role === "admin") {
                res.redirect("/admin-dashboard");
            } else if (user.role === "student") {
                res.redirect("/student-dashboard");
            } else {
                res.redirect("/home");
            }
        } else {
            res.send(`<script>alert("Wrong username or password"); window.location.href = "/";</script>`);
        }
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).send("Login error");
    }
});


// Forgot Password Routes
app.get("/forgot", (req, res) => {
    res.render("forgot");
});

// Forgot (POST)
app.post("/forgot", async (req, res) => {
    try {
        const { email } = req.body;
        const user = await collection.findOne({ email });

        if (!user) {
            return res.send("User not exist");
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore.set(email, { otp, expiresAt: Date.now() + 2 * 60 * 1000 });

        const mailOptions = {
            from: "quizify54@gmail.com",
            to: email,
            subject: "Your OTP for Reset Password",
            text: `Your OTP for Reset Password is: ${otp}. It expires in 2 minutes.`,
        };

        await transporter.sendMail(mailOptions);
        res.status(200).send("OTP sent successfully. Please check your email.");
    } catch (error) {
        console.error("Error during forgot password:", error);
        res.status(500).send("Forgot password error");
    }
});

//reset(POST)
app.post("/reset-password", async (req, res) => {
    try {
        const { email, fotp, newpassword, cnfpassword } = req.body;
        if (newpassword !== cnfpassword) {
            return res.status(400).send("Passwords do not match.");
        }

        const otpData = otpStore.get(email);
        if (!otpData || otpData.otp !== fotp) {
            return res.status(400).send("Invalid OTP.");
        }

        const hashedPassword = await bcrypt.hash(newpassword, 10);
        await collection.updateOne({ email: email }, { $set: { password: hashedPassword } });
        otpStore.delete(email);

        res.status(200).send("Password reset successful. You can now log in.");
    } catch (error) {
        console.error("Error during password reset:", error);
        res.status(500).send("Reset password error");
    }
});

////////////////////////////////////////////////////////////////////////////////////////

//admin dashboard route
app.get("/admin-dashboard", verifyToken, async (req, res) => {
    try {
        // Verify admin role
        if (req.user.role !== 'admin') {
            return res.status(403).send("Access denied");
        }

        let allQuizzes = await QuizTitle.find().populate('questions');
        const totalQuizzes = await QuizTitle.countDocuments();
        
        // Get recent results for all users
        const recentResults = await QuizResult.find()
            .populate('quiz')
            .sort({ completedAt: -1 })
            .limit(5);

        // Get active users count (users who have taken quizzes in the last 30 days)
        const activeUsers = await QuizResult.distinct('user', {
            completedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        });

        let quizzesWithStatus = allQuizzes.map(quiz => ({
            ...quiz.toObject(),
            isComplete: quiz.questions.length === quiz.que
        }));

        res.render("index", { 
            totalQuizzes, 
            users: quizzesWithStatus,
            activeUsersCount: activeUsers.length,
            recentResults: recentResults || []
        });
    } catch (error) {
        console.error("Admin dashboard error:", error);
        res.render("index", { 
            totalQuizzes: 0, 
            users: [],
            activeUsersCount: 0,
            recentResults: []
        });
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

app.get("/api/quiz-count", async (req, res) => {
  try {
    const totalQuizzes = await QuizTitle.countDocuments();
    res.json({ total: totalQuizzes });
  } catch (error) {
    console.error("Error fetching quiz count:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

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
            return res.status(400).json({ error: 'Invalid Quiz ID' });
        }

        const quiz = await QuizTitle.findById(quizId).populate('questions');
        if (!quiz) {
            console.error("Quiz not found", quizId);
            return res.status(404).json({ error: 'Quiz not found' });
        }

        const formattedQuestions = quiz.questions.map(q => ({
            _id: q._id,
            question: q.question,
            options: q.options,
            correct_answer: q.correct_answer,
            points: q.points
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
            { questions: questionId }, 
            { $pull: { questions: questionId } }
        );

        res.redirect("/manageview");
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

// Delete Quiz
app.delete("/api/quiz/:quizId", async (req, res) => {
    try {
        const { quizId } = req.params;
        const deletedQuiz = await QuizTitle.findByIdAndDelete(quizId);
  
        if (!deletedQuiz) return res.status(404).json({ error: "Quiz not found" });
  
        res.json({ message: "Quiz deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Student dashboard
app.get('/student-dashboard', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get available quizzes
        let allQuizzes = await QuizTitle.find().populate('questions');
        let validQuizzes = allQuizzes.filter(quiz => quiz.questions.length === quiz.que);

        // Get user's recent results
        const userResults = await QuizResult.find({ user: userId })
            .populate('quiz')
            .sort({ completedAt: -1 })
            .limit(5);

        res.render('user', { 
            users: validQuizzes,
            recentResults: userResults || []
        });
    } catch (error) {
        res.status(500).render('user', {
            users: [],
            recentResults: []
        });
    }
});

app.get('/profile', verifyToken, async (req, res) => {
    try {
        // Get user details with populated quiz results
        const user = await collection.findById(req.user.id)
            .select('-password')
            .populate({
                path: 'quizResults',
                populate: { path: 'quiz' },
                options: { sort: { 'completedAt': -1 } }
            });

        if (!user) {
            return res.status(404).send('User not found');
        }

        // Calculate statistics
        const totalAttempts = user.quizResults.length;
        const completedQuizzes = user.quizResults.filter(result => result.score > 0);
        const completionRate = (completedQuizzes.length / totalAttempts * 100) || 0;
        
        // Calculate average score
        const averageScore = user.quizResults.length > 0
            ? user.quizResults.reduce((acc, result) => acc + result.percentage, 0) / user.quizResults.length
            : 0;

        // Get performance data for chart (last 10 quizzes)
        const performanceData = user.quizResults
            .slice(0, 10)
            .reverse()
            .map(result => ({
                quizName: result.quiz.title,
                score: result.percentage,
                date: result.completedAt
            }));

        // Get latest quiz attempt
        const latestAttempt = user.quizResults[0];

        res.render('profile', {
            user,
            stats: {
                totalAttempts,
                completionRate: completionRate.toFixed(1),
                averageScore: averageScore.toFixed(1)
            },
            performanceData,
            latestAttempt,
            moment // Pass moment directly
        });

    } catch (error) {
        console.error('Profile page error:', error);
        res.status(500).send('Error loading profile');
    }
});


// Update profile
app.post('/profile/update', verifyToken, async (req, res) => {
    try {
        const { displayName } = req.body;
        
        const updatedUser = await collection.findByIdAndUpdate(
            req.user.id,
            { 
                displayName,
                lastActive: new Date()
            },
            { new: true }
        );

        res.json({ success: true, user: updatedUser });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ success: false, message: 'Error updating profile' });
    }
});

// Start Quiz
app.post("/startQuiz", verifyToken, async (req, res) => {
    try {
        const { quizId, answers } = req.body;
        const quiz = await QuizTitle.findById(quizId).populate('questions');
        const user = await collection.findById(req.user.id);

        if (!quiz) {
            return res.status(404).send("Quiz not found.");
        }

        let totalScore = 0;
        let correctAnswers = {};
        let correctcount=0,totalquecount=0;

        // Process each question
        quiz.questions.forEach((q) => {
            totalquecount++;
            correctAnswers[q._id] = q.correct_answer;
            if (answers && answers[q._id] && answers[q._id] === q.correct_answer) {
                correctcount++;
                totalScore += q.points;
            }
            
        });

        // Calculate total possible points and percentage
        const totalPossiblePoints = quiz.questions.reduce((sum, q) => sum + q.points, 0);
        const percentage = (totalScore / totalPossiblePoints) * 100;

        // Create quiz result
        const quizResult = await QuizResult.create({
            user: req.user.id,
            quiz: quizId,
            score: totalScore,
            totalPossibleScore: totalPossiblePoints,
            percentage: percentage,
            userName: req.user.name
        });

        // Update user statistics
        const userResults = await QuizResult.find({ user: req.user.id });
        const averageScore = userResults.reduce((acc, result) => acc + result.percentage, 0) / userResults.length;

        await collection.findByIdAndUpdate(req.user.id, {
            $push: { quizResults: quizResult._id },
            $inc: { totalQuizAttempts: 1 },
            averageScore: averageScore
        });

        // Render quiz results
        res.render('quizResult', { quiz, totalScore, totalPossiblePoints ,correctcount,totalquecount});
        
    } catch (error) {
        console.error("Error processing quiz:", error);
        res.status(500).send("Error processing quiz.");
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


// Start Server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});