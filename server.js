const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes'); // router TS punya kamu

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use('/videos', express.static(path.join(__dirname, 'videos'))); // buat video ep1.mp4
app.use(express.static(__dirname)); // serve index.html yg ada di root
app.use('/', routes); // pake router kamu langsung di root

app.listen(PORT, () => console.log(`Jalan: http://localhost:${PORT}`));