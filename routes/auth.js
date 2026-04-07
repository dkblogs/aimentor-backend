const express = require('express');
const router = express.Router();

router.post('/signup', (req, res) => {
  res.status(200).json({ error: 'Supabase isolated to frontend only.' });
});

router.post('/login', (req, res) => {
  res.status(200).json({ error: 'Supabase isolated to frontend only.' });
});

module.exports = router;
