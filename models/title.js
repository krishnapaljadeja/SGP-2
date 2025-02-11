const mongoose = require('mongoose');
const question = require('./question');

const con = mongoose.connect("mongodb+srv://jadejakrishnapal04:M1cKC56DzhxCeKjg@quizify.zgpmu.mongodb.net/?retryWrites=true&w=majority&appName=QuiziFY");
con.then(()=>{
  console.log('Connected to MongoDB');
}).catch(()=>{
  console.log('Error connecting to MongoDB');
})


const userSchema = new mongoose.Schema({
    title: { type: String, required: true },
    que: Number,
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }], // Properly referenced
    time: Number
});

module.exports = mongoose.model('QuizTitle', userSchema);
