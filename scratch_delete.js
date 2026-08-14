const fs = require('fs');
const path = require('path');

const target = 'C:\\Users\\Shubh\\Desktop\\Rubaru\\Rubaru';

function deleteFolderRecursive(directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file) => {
      const curPath = path.join(directoryPath, file);
      try {
        if (fs.lstatSync(curPath).isDirectory()) {
          deleteFolderRecursive(curPath);
        } else {
          // Clear read-only attributes on Windows if any
          fs.chmodSync(curPath, 0o666);
          fs.unlinkSync(curPath);
        }
      } catch (e) {
        console.warn(`Failed to delete file/dir ${curPath}:`, e.message);
      }
    });
    try {
      fs.rmdirSync(directoryPath);
    } catch (e) {
      console.warn(`Failed to remove directory ${directoryPath}:`, e.message);
    }
  }
}

console.log('Starting cleanup...');
deleteFolderRecursive(target);
console.log('Cleanup finished.');
