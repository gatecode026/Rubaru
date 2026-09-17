const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}
const mongoose = require('mongoose');
const { io: ioClient } = require('socket.io-client');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const User = require('../models/User');
const Profile = require('../models/Profile');
const FollowRelationship = require('../models/FollowRelationship');
const Conversation = require('../models/Conversation');
const ConversationMember = require('../models/ConversationMember');
const Message = require('../models/Message');

const BASE_URL = 'http://127.0.0.1:5000';

async function runVerification() {
  console.log('===============================================================');
  console.log('VERIFYING THREE CORE FEATURES END-TO-END');
  console.log('===============================================================\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log(' Connected to MongoDB Atlas: dating_app\n');

  // =========================================================================
  // BUG 1: OTP DELIVERY (MOBILE + EMAIL)
  // =========================================================================
  console.log('---------------------------------------------------------------');
  console.log('TESTING BUG 1: OTP GENERATION, GATEWAY DISPATCH & VERIFICATION');
  console.log('---------------------------------------------------------------');

  const testMobile = `+9199887${Math.floor(10000 + Math.random() * 90000)}`;
  const testEmail = `test_otp_${Date.now()}@rubaru.app`;

  // 1.1 Mobile OTP Send
  console.log(`[1.1] Registering Mobile: ${testMobile}...`);
  const mobileRegRes = await fetch(`${BASE_URL}/api/auth/register-phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: testMobile }),
  });
  const mobileRegData = await mobileRegRes.json();
  console.log('Mobile Reg Response Status:', mobileRegRes.status);
  console.log('Mobile Reg Body:', mobileRegData);

  if (mobileRegRes.status !== 201) throw new Error('Mobile registration failed');
  if (!mobileRegData.messageId) throw new Error('No delivery messageId in response');

  // Check DB for stored OTP
  const mobileUserDoc = await User.findOne({ phone: testMobile });
  if (!mobileUserDoc || !mobileUserDoc.otp || !mobileUserDoc.otp.code) {
    throw new Error('OTP was not stored on user in database');
  }
  console.log(`✅ Stored OTP in DB: ${mobileUserDoc.otp.code}, Expires: ${mobileUserDoc.otp.expiresAt}`);
  console.log(`✅ Provider Message ID: ${mobileRegData.messageId}, Gateway: ${mobileRegData.provider}`);

  // 1.2 Mobile OTP Resend
  console.log('\n[1.2] Testing Resend OTP for Mobile...');
  const mobileResendRes = await fetch(`${BASE_URL}/api/auth/resend-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: testMobile }),
  });
  const mobileResendData = await mobileResendRes.json();
  console.log('Mobile Resend Status:', mobileResendRes.status, mobileResendData);
  if (mobileResendRes.status !== 200) throw new Error('Mobile resend OTP failed');

  // 1.3 Verify OTP
  const freshMobileUser = await User.findOne({ phone: testMobile });
  console.log('\n[1.3] Verifying OTP...');
  const mobileVerifyRes = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: testMobile, otpCode: freshMobileUser.otp.code }),
  });
  const mobileVerifyData = await mobileVerifyRes.json();
  console.log('Mobile Verify Status:', mobileVerifyRes.status, mobileVerifyData);
  if (mobileVerifyRes.status !== 200 || !mobileVerifyData.token) throw new Error('OTP verification failed');
  console.log('✅ Mobile User verified and JWT token issued.\n');

  // 1.4 Email OTP Send
  console.log(`[1.4] Registering Email: ${testEmail}...`);
  const emailRegRes = await fetch(`${BASE_URL}/api/auth/register-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail }),
  });
  const emailRegData = await emailRegRes.json();
  console.log('Email Reg Response Status:', emailRegRes.status);
  console.log('Email Reg Body:', emailRegData);
  if (emailRegRes.status !== 201 || !emailRegData.messageId) throw new Error('Email registration failed');
  console.log(`✅ Provider Message ID: ${emailRegData.messageId}, Gateway: ${emailRegData.provider}\n`);


  // =========================================================================
  // BUG 2: CHAT MESSAGES PERSISTENCE, REAL-TIME & POPUP DELIVERY
  // =========================================================================
  console.log('---------------------------------------------------------------');
  console.log('TESTING BUG 2: CHAT MESSAGES PERSISTENCE, REAL-TIME & POPUP');
  console.log('---------------------------------------------------------------');

  // Fetch Raju Mistri (User 1) and Rahul K (User 2)
  const user1 = await User.findOne({ phone: '+917340445907' });
  const user2 = await User.findOne({ email: 'aj@gmail.com' });

  if (!user1 || !user2) throw new Error('User 1 or User 2 not found in database');

  const jwt = require('jsonwebtoken');
  const token1 = jwt.sign({ id: user1._id }, process.env.JWT_SECRET);
  const token2 = jwt.sign({ id: user2._id }, process.env.JWT_SECRET);

  console.log(`User 1: ${user1._id} (Raju Mistri)`);
  console.log(`User 2: ${user2._id} (Rahul K)\n`);

  // Connect both sockets concurrently
  console.log('[2.1] Connecting Sockets for User 1 and User 2...');
  const socket1 = ioClient(BASE_URL, {
    auth: { token: token1 },
    transports: ['websocket'],
  });
  const socket2 = ioClient(BASE_URL, {
    auth: { token: token2 },
    transports: ['websocket'],
  });

  await Promise.all([
    new Promise((resolve) => socket1.on('connect', resolve)),
    new Promise((resolve) => socket2.on('connect', resolve)),
  ]);

  console.log(`✅ Socket 1 Connected: ${socket1.id} (User: ${user1._id})`);
  console.log(`✅ Socket 2 Connected: ${socket2.id} (User: ${user2._id})\n`);

  // Setup listener on Socket 2 for real-time message and popup notification
  const receivedEventsOnUser2 = [];
  socket2.on('receive_message', (payload) => {
    console.log('📩 [User 2 Socket] Received event receive_message:', payload.text);
    receivedEventsOnUser2.push({ event: 'receive_message', payload });
  });
  socket2.on('notification:new', (payload) => {
    console.log('🔔 [User 2 Socket] Received event notification:new (POPUP BANNER):', payload.message);
    receivedEventsOnUser2.push({ event: 'notification:new', payload });
  });

  // User 1 sends message to User 2 via POST /api/chats/message
  const testMessageText = `Hello User B! Real-time check at ${Date.now()}`;
  console.log(`[2.2] User 1 sending message: "${testMessageText}" to User 2...`);

  const sendRes = await fetch(`${BASE_URL}/api/chats/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token1}`,
    },
    body: JSON.stringify({
      recipientId: user2._id.toString(),
      text: testMessageText,
    }),
  });
  const sendData = await sendRes.json();
  console.log('Send Message HTTP Status:', sendRes.status);
  console.log('Sent Message ID:', sendData._id, 'Conversation ID:', sendData.chat || sendData.conversationId);
  if (sendRes.status !== 201) throw new Error('Message sending failed');

  // Wait 1.5 seconds for socket event propagation
  await new Promise((r) => setTimeout(r, 1500));

  // Check Persistence in Database
  const persistedMsg = await Message.findById(sendData._id);
  if (!persistedMsg) throw new Error('Message was not persisted in database');
  console.log(`✅ Message verified in MongoDB Message collection: ${persistedMsg.text}`);

  // Check ConversationMember created for BOTH users
  const convId = sendData.chat || sendData.conversationId;
  const member1 = await ConversationMember.findOne({ conversationId: convId, userId: user1._id });
  const member2 = await ConversationMember.findOne({ conversationId: convId, userId: user2._id });

  if (!member1 || !member2) {
    throw new Error('ConversationMember was not created for both participants');
  }
  console.log(`✅ ConversationMember verified for User 1 (${member1.userId}) and User 2 (${member2.userId})`);

  // Assert User 2 received socket delivery
  const hasReceivedMsg = receivedEventsOnUser2.some((e) => e.event === 'receive_message');
  const hasReceivedPopup = receivedEventsOnUser2.some((e) => e.event === 'notification:new');
  if (!hasReceivedMsg) throw new Error('User 2 socket did NOT receive live message delivery');
  if (!hasReceivedPopup) throw new Error('User 2 socket did NOT receive in-app notification popup banner');
  console.log('✅ Real-time socket message delivered live to User 2 screen');
  console.log('✅ In-app popup banner event delivered live to User 2 screen');

  // User 2 queries conversation list (GET /v1/conversations) to prove refresh shows it
  console.log('\n[2.3] Testing User 2 conversation refresh (GET /v1/conversations)...');
  const user2ConvRes = await fetch(`${BASE_URL}/v1/conversations`, {
    headers: { Authorization: `Bearer ${token2}` },
  });
  const user2ConvData = await user2ConvRes.json();
  console.log('User 2 Conversation List count:', user2ConvData.items?.length);
  const matchedConv = user2ConvData.items?.find((c) => (c.id || c._id).toString() === convId.toString());
  if (!matchedConv) throw new Error('User 2 GET /v1/conversations does not return the conversation on refresh');
  console.log(`✅ User 2 conversation verified on refresh with last message: "${matchedConv.lastMessage?.text}"\n`);

  socket1.disconnect();
  socket2.disconnect();


  // =========================================================================
  // BUG 3: FOLLOW / FOLLOWING INSTAGRAM LIFECYCLE
  // =========================================================================
  console.log('---------------------------------------------------------------');
  console.log('TESTING BUG 3: INSTAGRAM FOLLOW / REQUESTED / UNFOLLOW LIFECYCLE');
  console.log('---------------------------------------------------------------');

  // Clean previous relationship
  await FollowRelationship.deleteMany({
    $or: [
      { followerId: user1._id, followingId: user2._id },
      { followerId: user2._id, followingId: user1._id },
    ],
  });

  // 3.1 Test Private Account Follow Flow
  console.log('[3.1] Setting User 2 to PRIVATE account...');
  await Profile.updateOne({ user: user2._id }, { $set: { socialAccountVisibility: 'PRIVATE' } });

  console.log('User 1 sends Follow request to private User 2...');
  const followPrivRes = await fetch(`${BASE_URL}/v1/users/${user2._id}/follow`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token1}` },
  });
  const followPrivData = await followPrivRes.json();
  console.log('Follow Private Response:', followPrivData);

  const privStatus = followPrivData.data?.relationship?.status;
  if (privStatus !== 'PENDING') throw new Error(`Expected PENDING status for private user, got ${privStatus}`);
  console.log('✅ Private account follow created "PENDING" (Requested) state.');

  // Check Follower count on User 2 profile (MUST NOT increment while PENDING)
  const profile2PendingRes = await fetch(`${BASE_URL}/api/profiles/${user2._id}`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  const profile2Pending = await profile2PendingRes.json();
  const dbRelPending = await FollowRelationship.findOne({ followerId: user1._id, followingId: user2._id });
  console.log(`Follower count on Profile: ${profile2Pending.followersCount}, DB status: ${dbRelPending.status}`);
  if (profile2Pending.followersCount !== 0) throw new Error('Follower count incremented prematurely on pending request');
  console.log('✅ Follower count remains 0 while in Requested state.');

  // 3.2 User 2 Accepts Request
  console.log('\n[3.2] User 2 accepts follow request...');
  const acceptRes = await fetch(`${BASE_URL}/v1/follow-requests/${dbRelPending._id}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token2}` },
  });
  const acceptData = await acceptRes.json();
  console.log('Accept Response:', acceptData);
  if (acceptRes.status !== 200) throw new Error('Failed to accept follow request');

  // Verify counts after acceptance
  const profile2AcceptedRes = await fetch(`${BASE_URL}/api/profiles/${user2._id}`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  const profile2Accepted = await profile2AcceptedRes.json();
  const dbRelAccepted = await FollowRelationship.findOne({ followerId: user1._id, followingId: user2._id });
  console.log(`✅ DB Status: ${dbRelAccepted.status}, User 2 Followers: ${profile2Accepted.followersCount}`);
  if (profile2Accepted.followersCount !== 1) throw new Error('Follower count did not increment to 1 after acceptance');

  // 3.3 User 1 Unfollows User 2
  console.log('\n[3.3] User 1 unfollows User 2...');
  const unfollowRes = await fetch(`${BASE_URL}/v1/users/${user2._id}/follow`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token1}` },
  });
  const unfollowData = await unfollowRes.json();
  console.log('Unfollow Response:', unfollowData);
  if (unfollowRes.status !== 200) throw new Error('Unfollow request failed');

  const profile2UnfollowedRes = await fetch(`${BASE_URL}/api/profiles/${user2._id}`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  const profile2Unfollowed = await profile2UnfollowedRes.json();
  const dbRelRemoved = await FollowRelationship.findOne({ followerId: user1._id, followingId: user2._id });
  console.log(`✅ DB Status: ${dbRelRemoved.status}, User 2 Followers: ${profile2Unfollowed.followersCount}`);
  if (profile2Unfollowed.followersCount !== 0) throw new Error('Follower count did not decrement to 0 after unfollow');

  // 3.4 Public Account Immediate Follow Flow
  console.log('\n[3.4] Setting User 2 to PUBLIC account and testing immediate Follow...');
  await Profile.updateOne({ user: user2._id }, { $set: { socialAccountVisibility: 'PUBLIC' } });

  const followPubRes = await fetch(`${BASE_URL}/v1/users/${user2._id}/follow`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token1}` },
  });
  const followPubData = await followPubRes.json();
  console.log('Follow Public Response:', followPubData);
  const pubStatus = followPubData.data?.relationship?.status;
  if (pubStatus !== 'ACCEPTED') throw new Error(`Expected ACCEPTED for public follow, got ${pubStatus}`);

  const profile2PublicRes = await fetch(`${BASE_URL}/api/profiles/${user2._id}`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  const profile2Public = await profile2PublicRes.json();
  console.log(`✅ User 2 Followers on Public Follow: ${profile2Public.followersCount}`);
  if (profile2Public.followersCount !== 1) throw new Error('Public follow did not increment follower count to 1');

  // 3.5 Verify Followers List & Following List Match FollowRelationship
  console.log('\n[3.5] Verifying Followers List against DB...');
  const followersListRes = await fetch(`${BASE_URL}/v1/users/${user2._id}/followers`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  const followersListData = await followersListRes.json();
  console.log('Followers list items count:', followersListData.data?.items?.length);
  if (followersListData.data?.items?.length !== 1 || followersListData.data.items[0].userId !== user1._id.toString()) {
    throw new Error('Followers list does not match FollowRelationship database record');
  }
  console.log(`✅ Followers list verified: Found User 1 (${followersListData.data.items[0].displayName})`);

  console.log('\n===============================================================');
  console.log('🎉 ALL THREE CORE FEATURES VERIFIED END-TO-END WITH PROOF!');
  console.log('===============================================================');

  await mongoose.disconnect();
  process.exit(0);
}

runVerification().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
