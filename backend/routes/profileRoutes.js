const express = require('express');
const {
  getMe,
  getProfile,
  editProfile,
  followProfile,
  getNearbyProfiles,
  searchProfiles,
  getAllProfiles,
} = require('../controllers/profileController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(protect);

router.get('/me', getMe);
router.get('/discover/nearby', getNearbyProfiles);
router.get('/search', searchProfiles);       // GET /api/profiles/search?q=...
router.get('/all', getAllProfiles);           // GET /api/profiles/all
router.get('/:userId', getProfile);
router.post('/:userId/follow', followProfile);


router.put(
  '/edit',
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'photos', maxCount: 9 },
  ]),
  editProfile
);

module.exports = router;
