const express = require("express");
const multer = require("multer");
const pdfdoc = require("pdfkit");
const fs = require("fs");
const path = require("path");
const fsPromises = fs.promises;
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { error } = require("console");

const app = express();
const port = 5000;
//configure multer
const upload = multer({ dest: "upload" });
app.use(express.json({ limit: "10mb" }));
//initialize gemini ai
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
app.use(express.static("public"));

//routes
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(4000).json({ error: "please uplaod image" });
    }
    const imgpath = req.file.path;
    const imagedata = await fsPromises.readFile(imgpath, {
      encoding: "base64",
    });
    //use gemini ai to analyze
    const model = genai.getGenerativeModel({
      model: "gemini-2.5-flash",
    });
    const results = await model.generateContent([
      "Analyze this plant image and provide detailed analysis of its species, health, and care recommendations, its characteristics, care instructions, and any interesting facts. Please provide the response in plain text without using any markdown formatting",
      {
        inlineData: {
          mimeType: req.file.mimetype,
          data: imagedata,
        },
      },
    ]);

    const plantInfo = results.response.text();
    //remove the uplaoded img
    //await fsPromises.unlink(imgpath)
    //send the response
    res.json({
      result: plantInfo,
      image: `data:${req.file.mimetype};base64,${imagedata}`,
    });
  } catch (error) {
    console.error("Error generating PDF report:", error);
    res
      .status(500)
      .json({ error: "An error occurred while generating the PDF report" });
  }
});
app.post("/download", express.json(), async (req, res) => {
  const { result, image } = req.body;
  try {
    //ensure report direc exists
    const reportsDir = path.join(__dirname, "reports");
    await fsPromises.mkdir(reportsDir, { recursive: true });
    const filename = `plant_analysis_report_${Date.now()}.pdf`;
    const filepath = path.join(reportsDir, filename);
    const writeStream = fs.createWriteStream(filepath);
    const doc = new pdfdoc();
    doc.pipe(writeStream);
    doc.fontSize(24).text("Plant Analysis Report", {
      align: "center",
    });
    doc.moveDown();
    doc.fontSize(24).text(`Dat:${new Date().toLocaleDateString()}`);
    doc.moveDown();
    doc.fontSize(24).text(result, { align: "left" });
    //inert img to pdf
    if (image) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      doc.moveDown();
      doc.image(buffer, {
        fit: [500, 300],
        align: "center",
        valign: "center",
      });
    }
    doc.end();
    //wait for pdf to be created
    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });
    res.download(filepath, (err) => {
      if (err) {
        res.status(500).json({ error: "Error downloading the PDF report" });
      }
      fsPromises.unlink(filepath);
    });
  } catch (error) {
    console.error("Error generating PDF report:", error);
    res
      .status(500)
      .json({ error: "An error occurred while generating the PDF report" });
  }
});

app.listen(port, () => {
  console.log("server started");
});
