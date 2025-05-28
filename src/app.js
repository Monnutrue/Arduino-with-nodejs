const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../view/index.html"));
});

let port, parser;
let isConnected = false;

app.post("/toggleSerial", (req, res) => {
    if (!isConnected) {
        // Connect
        port = new SerialPort({
            path: "COM11", // Ganti sesuai port Arduino kamu
            baudRate: 9600,
        });

        parser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }));

        parser.on("data", (result) => {
            console.log("data dari arduino:", result);

            if (result.startsWith("SUHU:")) {
                const suhu = result.split(":")[1];
                io.emit("suhu", { suhu });
            }

            io.emit("data", { data: result });
        });

        port.on("open", () => {
            console.log("Serial port terbuka");
            isConnected = true;
            res.json({ status: "connected" });
        });

        port.on("error", (err) => {
            console.error("Serial port error:", err.message);
            res.status(500).json({ status: "error", message: err.message });
        });

    } else {
        // Disconnect
        parser?.removeAllListeners("data");
        port.close((err) => {
            if (err) {
                console.error("Error saat menutup port:", err.message);
                return res.status(500).json({ status: "error", message: err.message });
            }
            console.log("Serial port ditutup");
            isConnected = false;
            res.json({ status: "disconnected" });
        });
    }
});

app.post("/arduinoAPI", (req, res) => {
    const data = req.body.data;
    if (isConnected && port && port.isOpen) {
        port.write(data, (err) => {
            if (err) {
                console.log("Write error:", err);
                res.status(500).json({ error: "Write error" });
            } else {
                console.log("Data terkirim ke Arduino:", data);
                res.end();
            }
        });
    } else {
        res.status(400).json({ error: "Serial port belum terkoneksi" });
    }
});

io.on("connection", (socket) => {
    console.log("Client terhubung");
    socket.on("disconnect", () => {
        console.log("Client terputus");
    });
});

server.listen(3000, () => {
    console.log("Server berjalan di port 3000");
});
