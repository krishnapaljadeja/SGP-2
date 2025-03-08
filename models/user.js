const mongoose = require('mongoose')
const connect = mongoose.connect("mongodb+srv://jadejakrishnapal04:23ce043@quizify.zgpmu.mongodb.net/test?retryWrites=true&w=majority&appName=QuiziFY");

connect.then(()=>{
    console.log('Database connected')
})
.catch(()=>{
    console.log('Database not connected')
})

const loginSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true 
    },
    password:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required: true
    },
    role:{
        type:String,
        required:true
    }
})

const collection = new mongoose.model("users",loginSchema)
module.exports = collection;