const { execSync } = require('child_process');

try {
  console.log('Running npm install...');
  execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });
  console.log('Success!');
} catch (error) {
  console.error('Error executing npm install:', error);
}
