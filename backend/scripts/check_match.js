const mongoose = require('mongoose');
require('dotenv').config();

async function checkUsers() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const caller = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId('6a9fd7a43964a145fa6a8b96') });
  const receiver = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId('6a9e5400fb3875cba738b108') });
  console.log('Caller:', caller?.name, caller?.email, caller?.phone);
  console.log('Receiver:', receiver?.name, receiver?.email, receiver?.phone);
  
  const allMatches = await db.collection('matches').find().toArray();
  const found = allMatches.find(m => {
    const ids = (m.users || []).map(u => u.toString());
    return ids.includes('6a9fd7a43964a145fa6a8b96') && ids.includes('6a9e5400fb3875cba738b108');
  });
  console.log('Match between them:', found);
  await mongoose.disconnect();
}
checkUsers();
