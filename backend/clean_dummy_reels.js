const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

require('dotenv').config();
const mongoose = require('mongoose');

async function clean() {
  await mongoose.connect(process.env.MONGO_URI);
  const Content = mongoose.model('Content', new mongoose.Schema({}, { strict: false }));

  // Delete all dummy mixkit reels, local file cache reels, and soft-deleted test reels
  const res = await Content.deleteMany({
    contentType: 'REEL',
    $or: [
      { 'mediaItems.variants.url': { $regex: 'mixkit', $options: 'i' } },
      { 'mediaItems.variants.url': { $regex: 'file://', $options: 'i' } },
      { 'mediaItems.variants.url': { $regex: 'pexels', $options: 'i' } },
      { caption: { $regex: 'Testing database', $options: 'i' } },
      { status: 'DELETED' }
    ]
  });
  console.log('Cleaned dummy/deleted reels count:', res.deletedCount);

  const remaining = await Content.find({ contentType: 'REEL' }).lean();
  console.log('Remaining real reels in DB:', remaining.length);
  remaining.forEach(r => console.log('Reel:', r._id.toString(), r.caption, r.mediaItems?.[0]?.variants?.[0]?.url));
  process.exit(0);
}

clean().catch(e => {
  console.error('Clean error:', e);
  process.exit(1);
});
