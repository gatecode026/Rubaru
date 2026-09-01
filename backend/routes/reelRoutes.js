const express = require('express');
const {
  createReel,
  getReels,
  likeReel,
  getUserReels,
} = require('../controllers/reelController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(protect);

router.post('/upload', upload.single('video'), createReel);
router.get('/', getReels);
router.get('/user/me', getUserReels);
router.get('/user/:userId', getUserReels);
router.post('/:id/like', likeReel);

module.exports = router;
