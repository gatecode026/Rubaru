const fs = require('fs');
const path = require('path');

const srcDir = 'C:\\Users\\Shubh\\.gemini\\antigravity-ide\\brain\\65b2d39e-5e49-4ad0-84f6-ef5795e37f51';
const destDir = path.join(__dirname, 'src', 'assets', 'images');

const filesToCopy = [
  { src: 'rubaru_dating_icon_1786685472607.png', dest: 'icon.png' },
  { src: 'rubaru_dating_adaptive_icon_1786685489626.png', dest: 'adaptive-icon.png' },
  { src: 'rubaru_dating_splash_1786685608841.png', dest: 'splash.png' },
  { src: 'rubaru_dating_icon_1786685472607.png', dest: 'favicon.png' }
];

console.log('Copying dating assets from temp artifact directory to project assets...');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

filesToCopy.forEach(item => {
  const srcPath = path.join(srcDir, item.src);
  const destPath = path.join(destDir, item.dest);
  
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Successfully copied ${item.src} -> ${item.dest}`);
  } else {
    console.error(`Source file not found: ${srcPath}`);
  }
});

console.log('Asset fix complete!');
