const express = require("express");
const multer = require("multer");
const path = require("path");
const { exec } = require("child_process");
const fs = require("fs");
const ejs = require("ejs");
const mongoose = require("mongoose");
const archiver = require("archiver");
const stream = require("stream");
const { GridFSBucket } = require("mongodb");

const app = express();
const port = process.env.PORT || 55000;

const upload = multer({ storage: multer.memoryStorage() });

const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
  console.error("MONGODB_URI is not defined");
  process.exit(1);
}

mongoose.connect(mongoURI)
  .then(() => {
    console.log("Connected to MongoDB.");
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
    process.exit(1); // 연결 실패 시 애플리케이션 종료
  });

const conn = mongoose.connection;
let gridFSBucket;

conn.once("open", () => {
  gridFSBucket = new GridFSBucket(conn.db, {
    bucketName: 'uploads'
  });
  console.log("GridFS Bucket set up.");
});

const uploadSchema = new mongoose.Schema({
  originalFilename: { type: String, required: true },
  fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  uploadTime: { type: Date, default: Date.now }
});

const Upload = mongoose.model('Upload', uploadSchema);

app.set("view engine", "html");
app.engine("html", ejs.renderFile);
app.set("views", path.join(__dirname, "views"));

// Ensure temp directory exists
const tempDir = path.join(__dirname, "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

app.get("/", async (req, res) => {
  try {
    const uploads = await Upload.find();
    const recoveredFiles = fs.readdirSync(tempDir).filter(file => fs.lstatSync(path.join(tempDir, file)).isDirectory());
    res.render("index", { uploads, recoveredFiles });
  } catch (err) {
    console.error("Error fetching data from DB:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/upload", upload.single("file"), async (req, res) => {
  const originalFilename = req.file.originalname;

  try {
    const readableStream = new stream.PassThrough();
    readableStream.end(req.file.buffer);

    const uploadStream = gridFSBucket.openUploadStream(originalFilename);
    readableStream.pipe(uploadStream);

    uploadStream.on('finish', async () => {
      const newUpload = new Upload({ originalFilename, fileId: uploadStream.id });
      await newUpload.save();
      res.redirect("/");
    });

  } catch (err) {
    console.error("Error saving upload to DB:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/recover/:id", async (req, res) => {
  const uploadId = req.params.id;

  try {
    const file = await Upload.findById(uploadId);
    if (!file) {
      return res.status(404).send("File not found");
    }

    const tempFilePath = path.join(tempDir, file.originalFilename);
    const downloadStream = gridFSBucket.openDownloadStream(file.fileId);
    const writableStream = fs.createWriteStream(tempFilePath);

    downloadStream.pipe(writableStream);

    writableStream.on('close', () => {
      const outputDir = path.join(tempDir, file._id.toString());

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const runPhotoRec = (filepath) => {
        const photorecPath = path.join(__dirname, "testdisk-7.2", "photorec_win.exe");
        const outputDirEscaped = outputDir.replace(/\\/g, '\\\\');
        const command = `"${photorecPath}" /log /d "${outputDirEscaped}" "${filepath.replace(/\\/g, '\\\\')}"`;


        console.log("Executing command:", command);

        exec(command, { cwd: path.resolve(__dirname) }, async (error, stdout, stderr) => {
          if (error) {
            console.error(`Error running PhotoRec: ${error.message}`);
            return res.status(500).send("Internal Server Error");
          }
          if (stderr) {
            console.error(`Stderr: ${stderr}`);
            return res.status(500).send("Internal Server Error");
          }

          const recoveredFiles = fs.readdirSync(outputDir);
          recoveredFiles.forEach(file => console.log(`Recovered file: ${file}`));

          fs.unlinkSync(tempFilePath);
          res.redirect("/");
        });
      };

      runPhotoRec(tempFilePath);
    });

  } catch (err) {
    console.error("Error fetching upload from DB:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/delete/:id", async (req, res) => {
  const uploadId = req.params.id;

  try {
    const file = await Upload.findById(uploadId);
    if (file) {
      await gridFSBucket.delete(file.fileId);
    }
    await Upload.findByIdAndDelete(uploadId);
    res.redirect("/");
  } catch (err) {
    console.error("Error deleting upload from DB:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/delete-recovered/:folder", async (req, res) => {
  const folderName = req.params.folder;
  const outputDir = path.join(tempDir, folderName);

  if (!fs.existsSync(outputDir)) {
    return res.status(404).send("Folder not found");
  }

  fs.rmdirSync(outputDir, { recursive: true });
  res.redirect("/");
});

app.post("/download/:id", async (req, res) => {
  const folderName = req.params.id;
  const outputDir = path.join(tempDir, folderName);

  if (!fs.existsSync(outputDir)) {
    return res.status(404).send("File not found");
  }

  const zip = archiver("zip", {
    zlib: { level: 9 },
  });

  res.attachment(`${folderName}.zip`);

  zip.on("finish", async () => {
    console.log(`Deleted folder: ${outputDir}`);
  });

  zip.pipe(res);

  const files = fs.readdirSync(outputDir);
  files.forEach(file => {
    const filePath = path.join(outputDir, file);
    const fileStream = fs.createReadStream(filePath);
    zip.append(fileStream, { name: file });
  });

  zip.finalize();
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
