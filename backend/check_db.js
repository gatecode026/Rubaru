require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Chat = require('./models/Chat');
const Message = require('./models/Message');
const User = require('./models/User');
const Profile = require('./models/Profile');

async function check() {
  const mongoUri = process.env.MONGO_URI || 'mongodb+srv://gatecode026:tBNyNzO68BNn3Zkn@cluster0.1meot8l.mongodb.net/dating_app';
  await mongoose.connect(mongoUri);
  console.log('Connected to DB');

  // Let's inspect the chat for User B: 6a8d5085295b85a685035280
  const userBId = '6a8d5085295b85a685035280';
  const chats = await Chat.find({
    participants: userBId
  }).populate('participants', '_id');

  console.log(`Chats found for User B: ${chats.length}`);
  for (const chat of chats) {
    const otherParticipantId = chat.participants.find(
      (p) => p._id.toString() !== userBId
    )?._id;

    console.log(`Chat ID: ${chat._id}`);
    console.log(`Other Participant ID: ${otherParticipantId}`);

    if (otherParticipantId) {
      const otherProfile = await Profile.findOne({ user: otherParticipantId });
      console.log(`Other Profile found:`, !!otherProfile);
      if (otherProfile) {
        console.log(`Other Profile user (ObjectId):`, otherProfile.user);
        console.log(`Other Profile user stringified:`, otherProfile.user.toString());
      }
    }
  }

  await mongoose.disconnect();
}

check();
