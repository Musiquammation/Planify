import express from "express";
import fs from "fs";
import https from "https";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors({
    origin: "https://musiquammation.github.io",
}));

app.use(express.text());
app.use(express.json());

app.post("/planifyUserTracker", (req, res) => {
    let hash: string;

    if (typeof req.body === "string") hash = req.body;
    else if (req.body.hash) hash = req.body.hash;
    else hash = "unknown";


    const line = `${Date.now()}\t${hash}\n`;

    console.log(line);

    fs.appendFile("output.txt", line, (err) => {
        if (err) console.error("Erreur écriture fichier:", err);
    });

    res.sendStatus(200);
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 443;
const KEY_PATH = process.env.KEY_PATH || "./key.pem";
const CERT_PATH = process.env.CERT_PATH || "./cert.pem";

const options = {
    key: fs.readFileSync(KEY_PATH),
    cert: fs.readFileSync(CERT_PATH)
};

https.createServer(options, app).listen(PORT, () => {
    console.log(`Listening on ${PORT}`);
});