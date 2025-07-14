const express= require('express')
const multer= require('multer')
const pdfkit= require('pdfkit')
const fs= require('fs')
const path= require('path')
const fsPromises=fs.promises
require('dotenv').config()
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { error } = require('console')

const app=express()
const port =5000
//configure multer
const upload=multer({dest:"upload"})
app.use(express.json({limit:"10mb"}))
//initialize gemini ai
const genai=new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
app.use(express.static("public"))


//routes
app.post('/analyze', upload.single("image"),async(req,res)=>{
    try{
        if(!req.file){
            return res.status(4000).json({error:"please uplaod image"})
        }
        const imgpath=req.file.path
        const imagedata=await fsPromises.readFile(imgpath,{
            encoding:"base64"
        })
        //use gemini ai to analyze
        const model=genai.getGenerativeModel({
            model:"gemini-2.5-flash",
        })
        const results=await model.generateContent([
            "Analyze this plant image and provide detailed analysis of its species, health, and care recommendations, its characteristics, care instructions, and any interesting facts. Please provide the response in plain text without using any markdown formatting",{
                inlineData:{
                    mimeType:req.file.mimetype,
                    data:imagedata
                }
            }
        ])

        const plantInfo=results.response.text()
        //remove the uplaoded img
        //await fsPromises.unlink(imgpath)
        //send the response
        res.json({
            results:plantInfo,image:`data:${req.file.mimetype};base64,${imagedata}`
        })
    }catch(error){
        res.status(500).json({error:error.message

    })    
}
   

    
})
app.post('/download',async(req,res)=>{
    res.json({success:true})

})




app.listen(port,()=>{
    console.log('server started');
    
})