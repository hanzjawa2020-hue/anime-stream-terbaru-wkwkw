const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
const BASE_URL = 'https://otakudesu.cloud';

app.get('/api/ongoing', async (req, res) => {
  try {
    const { data } = await axios.get(`${BASE_URL}/ongoing-anime/`);
    const $ = cheerio.load(data);
    const result = [];
    $('.venz li').each((i, el) => {
      result.push({
        title: $(el).find('.jdlflm').text().trim(),
        episode: $(el).find('.epz').text().trim(),
        thumb: $(el).find('img').attr('src'),
        slug: $(el).find('a').attr('href').split('/')[4]
      });
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Gagal scrape ongoing' });
  }
});

app.get('/api/complete', async (req, res) => {
  try {
    const { data } = await axios.get(`${BASE_URL}/complete-anime/`);
    const $ = cheerio.load(data);
    const result = [];
    $('.venz li').each((i, el) => {
      result.push({
        title: $(el).find('.jdlflm').text().trim(),
        episode: $(el).find('.epz').text().trim(),
        thumb: $(el).find('img').attr('src'),
        slug: $(el).find('a').attr('href').split('/')[4]
      });
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Gagal scrape complete' });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    const { data } = await axios.get(`${BASE_URL}/?s=${q}&post_type=anime`);
    const $ = cheerio.load(data);
    const result = [];
    $('.chivsrc li').each((i, el) => {
      result.push({
        title: $(el).find('h2 a').text().trim(),
        thumb: $(el).find('img').attr('src'),
        slug: $(el).find('a').attr('href').split('/')[4]
      });
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Gagal search' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API jalan di port ${PORT}`));