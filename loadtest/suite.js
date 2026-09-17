import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Load seed data and fixtures
const seedData = JSON.parse(open('./users.json'));
const sampleImageBytes = open('./fixtures/sample_image.jpg', 'b');
const sampleReelBytes = open('./fixtures/sample_reel.mp4', 'b');

// Custom metrics per action type
const readLatency = new Trend('rubaru_read_latency', true);
const engageLatency = new Trend('rubaru_engage_latency', true);
const uploadImageLatency = new Trend('rubaru_upload_image_latency', true);
const uploadReelLatency = new Trend('rubaru_upload_reel_latency', true);

const readErrors = new Rate('rubaru_read_errors');
const engageErrors = new Rate('rubaru_engage_errors');
const uploadImageErrors = new Rate('rubaru_upload_image_errors');
const uploadReelErrors = new Rate('rubaru_upload_reel_errors');

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:5000';

// Scenarios: Quick ramp vs full 30-min soak
const isQuick = __ENV.QUICK === 'true';

export const options = isQuick
  ? {
      // 1.5-minute measurement ramp to capture empirical p50/p95/p99 & breaking point
      stages: [
        { duration: '15s', target: 50 },
        { duration: '20s', target: 250 },
        { duration: '25s', target: 500 },
        { duration: '30s', target: 1000 },
        { duration: '15s', target: 0 },
      ],
      thresholds: {
        http_req_failed: ['rate<0.10'], // Under 10% errors threshold
        http_req_duration: ['p(95)<3000'], // 95% of requests below 3s
      },
    }
  : {
      // Full spec: Ramp 0 -> 250 -> 500 -> 1000 -> 1500 VUs + 30-min soak at 1000
      stages: [
        { duration: '2m', target: 250 },
        { duration: '3m', target: 500 },
        { duration: '5m', target: 1000 },
        { duration: '5m', target: 1500 },
        { duration: '30m', target: 1000 }, // 30-min soak
        { duration: '2m', target: 0 },
      ],
      thresholds: {
        http_req_failed: ['rate<0.05'],
        http_req_duration: ['p(95)<2000'],
      },
    };

export default function () {
  const vuIndex = __VU % seedData.users.length;
  const user = seedData.users[vuIndex] || seedData.users[0];
  const celebrity = seedData.celebrity;

  const authHeaders = {
    Authorization: `Bearer ${user.token}`,
  };

  // Weighted traffic randomizer
  const roll = Math.random();

  if (roll < 0.70) {
    // ==========================================
    // 70% READ ACTIONS
    // ==========================================
    const readChoice = Math.floor(Math.random() * 4);
    let res;

    if (readChoice === 0) {
      // 1. Home Feed
      const t0 = Date.now();
      res = http.get(`${BASE_URL}/v1/feed?limit=15`, { headers: authHeaders });
      readLatency.add(Date.now() - t0);
      readErrors.add(res.status !== 200);
      check(res, { 'Feed status 200': (r) => r.status === 200 });
    } else if (readChoice === 1) {
      // 2. Reels Feed
      const t0 = Date.now();
      res = http.get(`${BASE_URL}/v1/reels/feed?limit=10`, { headers: authHeaders });
      readLatency.add(Date.now() - t0);
      readErrors.add(res.status !== 200);
      check(res, { 'Reels feed status 200': (r) => r.status === 200 });
    } else if (readChoice === 2) {
      // 3. Story Tray
      const t0 = Date.now();
      res = http.get(`${BASE_URL}/v1/stories/feed`, { headers: authHeaders });
      readLatency.add(Date.now() - t0);
      readErrors.add(res.status !== 200);
      check(res, { 'Stories tray status 200': (r) => r.status === 200 });
    } else {
      // 4. Celebrity Profile Reels & Post Comments
      const targetReel = seedData.reelIds[Math.floor(Math.random() * seedData.reelIds.length)];
      const targetPost = seedData.postIds[Math.floor(Math.random() * seedData.postIds.length)];
      const t0 = Date.now();
      res = http.get(`${BASE_URL}/v1/content/${targetPost}/comments?limit=10`, { headers: authHeaders });
      readLatency.add(Date.now() - t0);
      readErrors.add(res.status !== 200);
      check(res, { 'Comments status 200': (r) => r.status === 200 });
    }
  } else if (roll < 0.85) {
    // ==========================================
    // 15% ENGAGE ACTIONS (Likes, Comments, Views)
    // ==========================================
    const engageChoice = Math.floor(Math.random() * 3);
    let res;

    if (engageChoice === 0) {
      // 1. Like Content
      const targetContent = seedData.postIds[Math.floor(Math.random() * seedData.postIds.length)];
      const t0 = Date.now();
      res = http.post(`${BASE_URL}/v1/content/${targetContent}/like`, JSON.stringify({}), {
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
      });
      engageLatency.add(Date.now() - t0);
      engageErrors.add(res.status !== 200 && res.status !== 201);
      check(res, { 'Like status 200/201': (r) => r.status === 200 || r.status === 201 });
    } else if (engageChoice === 1) {
      // 2. Add Comment
      const targetPost = seedData.postIds[Math.floor(Math.random() * seedData.postIds.length)];
      const payload = JSON.stringify({
        text: `Automated concurrency comment from VU ${__VU} at ${Date.now()}`,
      });
      const t0 = Date.now();
      res = http.post(`${BASE_URL}/v1/content/${targetPost}/comments`, payload, {
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
      });
      engageLatency.add(Date.now() - t0);
      engageErrors.add(res.status !== 200 && res.status !== 201);
      check(res, { 'Comment status 200/201': (r) => r.status === 200 || r.status === 201 });
    } else {
      // 3. Record Story View
      const targetStory = seedData.storyIds[Math.floor(Math.random() * seedData.storyIds.length)];
      const t0 = Date.now();
      res = http.post(`${BASE_URL}/v1/stories/${targetStory}/view`, JSON.stringify({ eventId: `k6_${__VU}_${Date.now()}` }), {
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
      });
      engageLatency.add(Date.now() - t0);
      engageErrors.add(res.status !== 200 && res.status !== 201);
      check(res, { 'Story view status 200/201': (r) => r.status === 200 || r.status === 201 });
    }
  } else if (roll < 0.95) {
    // ==========================================
    // 10% STORY / IMAGE POST UPLOAD
    // ==========================================
    const imgData = {
      file: http.file(sampleImageBytes, 'sample_image.jpg', 'image/jpeg'),
      purpose: 'POST',
    };
    const t0 = Date.now();
    const res = http.post(`${BASE_URL}/v1/media/upload`, imgData, {
      headers: authHeaders,
    });
    uploadImageLatency.add(Date.now() - t0);
    uploadImageErrors.add(res.status !== 201);
    check(res, { 'Image upload status 201': (r) => r.status === 201 });
  } else {
    // ==========================================
    // 5% REEL UPLOAD (Multipart Video)
    // ==========================================
    const reelData = {
      video: http.file(sampleReelBytes, 'sample_reel.mp4', 'video/mp4'),
      caption: `Concurrent test reel from VU ${__VU} #loadtest`,
      audience: 'PUBLIC',
    };
    const t0 = Date.now();
    const res = http.post(`${BASE_URL}/v1/reels`, reelData, {
      headers: authHeaders,
    });
    uploadReelLatency.add(Date.now() - t0);
    uploadReelErrors.add(res.status !== 201 && res.status !== 200);
    check(res, { 'Reel upload status 201': (r) => r.status === 201 || r.status === 200 });
  }

  sleep(0.5 + Math.random() * 0.5); // 500ms - 1s think time
}
