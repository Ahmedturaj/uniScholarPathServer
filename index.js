const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000
const app = express();
// middleWare
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())

app.get('/', (req,res)=>{
    res.send('The final assignment will be rock........')
})
app.listen(port,()=>{
    console.log(`the post number is ${port}`);
})