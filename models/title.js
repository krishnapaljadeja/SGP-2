const mongoose = require('mongoose');
const question = require('./question');
// const con=mongoose.connect("mongodb://localhost:27017/")

const con = mongoose.connect("mongodb+srv://jadejakrishnapal04:23ce043@quizify.zgpmu.mongodb.net/test?retryWrites=true&w=majority&appName=QuiziFY");

con.then(()=>{
  console.log('Connected to MongoDB');
}).catch(()=>{
  console.log('Error connecting to MongoDB');
})


const userSchema = new mongoose.Schema({
    title: { type: String, required: true },
    que: {type : Number, required:true },
     questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }], 
    time: {type:Number, required:true}
});

module.exports = mongoose.model('QuizTitle', userSchema);
