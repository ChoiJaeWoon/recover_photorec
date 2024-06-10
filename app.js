const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ejs = require("ejs");
const mongoose = require("mongoose");
const http = require("http");
const socketIo = require("socket.io");
const pty = require("node-pty");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

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
    process.exit(1);
  });

const conn = mongoose.connection;
let gridFSBucket;

conn.once("open", () => {
  gridFSBucket = new mongoose.mongo.GridFSBucket(conn.db, {
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

app.use(express.static(path.join(__dirname, 'public')));

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
      const recoveredDir = path.join(__dirname, "recovered_files", file._id.toString());

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      if (!fs.existsSync(recoveredDir)) {
        fs.mkdirSync(recoveredDir, { recursive: true });
      }

      const runPhotoRec = (tempFilePath, outputDir, uploadId, recoveredDir) => {
        const photorecPath = "/app/tools/photorec_static";
        const commandArgs = ["/log", "/d", outputDir, tempFilePath];

        console.log("Executing command:", photorecPath, commandArgs);

        const ptyProcess = pty.spawn(photorecPath, commandArgs, {
          name: "xterm-color",
          cols: 80,
          rows: 24,
          cwd: process.env.HOME,
          env: process.env,
        });

        io.on("connection", (socket) => {
          console.log("Client connected");

          ptyProcess.on("data", (data) => {
            socket.emit('photorec-output', data);
          });

          socket.on("input", (input) => {
            ptyProcess.write(input);
          });

          socket.on("resize", (size) => {
            ptyProcess.resize(size.cols, size.rows);
          });

          socket.on("disconnect", () => {
            console.log("Client disconnected");
            ptyProcess.kill();
          });
        });

        ptyProcess.on("exit", async (code) => {
          console.log(`PhotoRec exited with code ${code}`);

          const getAllFiles = (dirPath, arrayOfFiles) => {
            let files = fs.readdirSync(dirPath);

            arrayOfFiles = arrayOfFiles || [];

            files.forEach((file) => {
              if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
                arrayOfFiles = getAllFiles(path.join(dirPath, file), arrayOfFiles);
              } else {
                arrayOfFiles.push(path.join(dirPath, file));
              }
            });

            return arrayOfFiles;
          };

          const recoveredFiles = getAllFiles(outputDir);
          console.log(`Recovered files: ${recoveredFiles}`);

          if (recoveredFiles.length === 0) {
            console.error("No files recovered by PhotoRec.");
            return res.status(500).send("No files recovered");
          }

          try {
            for (const filePath of recoveredFiles) {
              const filename = path.basename(filePath);
              const destinationPath = path.join(recoveredDir, filename);
              console.log(`Moving file to: ${destinationPath}`);

              fs.renameSync(filePath, destinationPath);

              console.log(`Inserting into DB - File: ${filename}, Path: ${destinationPath}`);

              await Output.create({ upload_id: uploadId, filename, file_path: destinationPath });
            }
            fs.unlinkSync(tempFilePath);
            fs.rmSync(outputDir, { recursive: true, force: true });

            res.redirect(`/results/${uploadId}`);
          } catch (err) {
            console.error("Error inserting recovered files:", err);
            res.status(500).send("Internal Server Error");
          }
        });
      };

      runPhotoRec(tempFilePath, outputDir, file._id, recoveredDir);
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

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
