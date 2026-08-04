require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// Serve static assets (CSS-in-file HTML pages, so mostly just the pages
// themselves and pesapal-callback.html). index:false stops Express from
// auto-serving public/index.html for "/" — we route that explicitly below
// so the marketing page, not the builder, is what greets a first-time visitor.
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'landing.html'));
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Fallback for any other path (e.g. a refresh on a client-side route)
// sends the builder, since that's the app's main authenticated surface.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`JengaCV server listening on port ${PORT}`));
