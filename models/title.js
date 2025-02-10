const mongoose = require('mongoose');
const question = require('./question');

const con = mongoose.connect('mongodb://127.0.0.1:27017/QuiziFY');
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
