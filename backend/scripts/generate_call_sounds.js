const fs = require('fs');
const path = require('path');

function createWavBuffer(samples, sampleRate = 44100) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF identifier
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write samples
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    buffer.writeInt16LE(Math.round(val), 44 + i * 2);
  }

  return buffer;
}

const sampleRate = 44100;

// 1. Ringback tone (Outgoing Call Ringing: 440Hz + 480Hz dual tone, 1.5s beep + 2s silence)
function generateRingback() {
  const duration = 3.5;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);
  const beepSamples = Math.floor(sampleRate * 1.5);

  for (let i = 0; i < beepSamples; i++) {
    const t = i / sampleRate;
    // Envelope for smooth click-free start and end
    let env = 1.0;
    if (i < 500) env = i / 500;
    else if (i > beepSamples - 500) env = (beepSamples - i) / 500;

    const s1 = Math.sin(2 * Math.PI * 440 * t);
    const s2 = Math.sin(2 * Math.PI * 480 * t);
    samples[i] = (s1 + s2) * 0.25 * env;
  }
  return createWavBuffer(samples, sampleRate);
}

// 2. Incoming Ringtone (Pleasant melodic marimba/bell sequence, 3s loop)
function generateRingtone() {
  const duration = 3.0;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  // Chime notes: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz), B5 (987.77Hz), C6 (1046.5Hz)
  const notes = [
    { freq: 523.25, start: 0.0, dur: 0.35 },
    { freq: 659.25, start: 0.25, dur: 0.35 },
    { freq: 783.99, start: 0.5, dur: 0.35 },
    { freq: 1046.5, start: 0.75, dur: 0.6 },
    { freq: 783.99, start: 1.4, dur: 0.35 },
    { freq: 987.77, start: 1.65, dur: 0.35 },
    { freq: 1046.5, start: 1.9, dur: 0.8 },
  ];

  notes.forEach(({ freq, start, dur }) => {
    const startSample = Math.floor(start * sampleRate);
    const numSamples = Math.floor(dur * sampleRate);
    for (let i = 0; i < numSamples; i++) {
      const idx = startSample + i;
      if (idx >= totalSamples) break;
      const t = i / sampleRate;
      // Exponential decay envelope for chime sound
      const env = Math.exp(-4.5 * (i / numSamples));
      const s = Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(2 * Math.PI * freq * 2 * t);
      samples[idx] += s * 0.25 * env;
    }
  });

  return createWavBuffer(samples, sampleRate);
}

// 3. Call Connect / Pick Sound (Ascending cheerful two-tone chime, 0.4s)
function generateCallConnect() {
  const duration = 0.5;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  const notes = [
    { freq: 587.33, start: 0.0, dur: 0.2 }, // D5
    { freq: 880.0, start: 0.18, dur: 0.3 }, // A5
  ];

  notes.forEach(({ freq, start, dur }) => {
    const startSample = Math.floor(start * sampleRate);
    const numSamples = Math.floor(dur * sampleRate);
    for (let i = 0; i < numSamples; i++) {
      const idx = startSample + i;
      if (idx >= totalSamples) break;
      const t = i / sampleRate;
      const env = Math.exp(-5.0 * (i / numSamples));
      const s = Math.sin(2 * Math.PI * freq * t);
      samples[idx] += s * 0.35 * env;
    }
  });

  return createWavBuffer(samples, sampleRate);
}

// 4. Call End / Hangup Sound (Three gentle descending beeps, 0.6s)
function generateCallEnd() {
  const duration = 0.65;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  const notes = [
    { freq: 480.0, start: 0.0, dur: 0.12 },
    { freq: 400.0, start: 0.16, dur: 0.12 },
    { freq: 320.0, start: 0.32, dur: 0.25 },
  ];

  notes.forEach(({ freq, start, dur }) => {
    const startSample = Math.floor(start * sampleRate);
    const numSamples = Math.floor(dur * sampleRate);
    for (let i = 0; i < numSamples; i++) {
      const idx = startSample + i;
      if (idx >= totalSamples) break;
      const t = i / sampleRate;
      const env = Math.exp(-4.0 * (i / numSamples));
      const s = Math.sin(2 * Math.PI * freq * t);
      samples[idx] += s * 0.3 * env;
    }
  });

  return createWavBuffer(samples, sampleRate);
}

// 5. Reconnect Alert Sound (Subtle double-ping alert, 0.4s)
function generateCallReconnect() {
  const duration = 0.5;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  const notes = [
    { freq: 659.25, start: 0.0, dur: 0.15 }, // E5
    { freq: 659.25, start: 0.2, dur: 0.25 }, // E5
  ];

  notes.forEach(({ freq, start, dur }) => {
    const startSample = Math.floor(start * sampleRate);
    const numSamples = Math.floor(dur * sampleRate);
    for (let i = 0; i < numSamples; i++) {
      const idx = startSample + i;
      if (idx >= totalSamples) break;
      const t = i / sampleRate;
      const env = Math.exp(-6.0 * (i / numSamples));
      const s = Math.sin(2 * Math.PI * freq * t);
      samples[idx] += s * 0.28 * env;
    }
  });

  return createWavBuffer(samples, sampleRate);
}

const outDir = path.resolve(__dirname, '../../src/assets/sounds');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'ringback.wav'), generateRingback());
fs.writeFileSync(path.join(outDir, 'ringtone.wav'), generateRingtone());
fs.writeFileSync(path.join(outDir, 'call_connect.wav'), generateCallConnect());
fs.writeFileSync(path.join(outDir, 'call_end.wav'), generateCallEnd());
fs.writeFileSync(path.join(outDir, 'call_reconnect.wav'), generateCallReconnect());

console.log('All call sound assets generated successfully in src/assets/sounds!');
