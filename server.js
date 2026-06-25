const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes'); // router TS punya kamu

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use('/videos', express.static(path.join(__dirname, 'videos'))); // serve video
app.use(express.static(path.join(__dirname, 'public'))); // serve index.html
app.use('/', routes); // pake router kamu langsung di root, biar sama kayak SS kamu

app.listen(PORT, () => console.log(`Jalan: http://localhost:${PORT}`));