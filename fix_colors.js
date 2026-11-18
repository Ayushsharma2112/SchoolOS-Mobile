const fs = require('fs');
const path = require('path');

const replacementMap = [
  { regex: /indigo-650/g, replacement: 'indigo-600' },
  { regex: /indigo-750/g, replacement: 'indigo-700' },
  { regex: /indigo-755/g, replacement: 'indigo-700' },
  { regex: /indigo-775/g, replacement: 'indigo-700' },
  { regex: /violet-650/g, replacement: 'violet-600' },
  { regex: /violet-750/g, replacement: 'violet-700' },
  { regex: /slate-955/g, replacement: 'slate-950' },
  { regex: /bg-indigo-955/g, replacement: 'bg-indigo-900' },
];

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== '.next' && f !== '.git') {
        walkDir(dirPath, callback);
      }
    } else {
      if (f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.css')) {
        callback(dirPath);
      }
    }
  });
}

function fixColorsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    let modified = false;

    replacementMap.forEach(({ regex, replacement }) => {
      if (regex.test(content)) {
        content = content.replace(regex, replacement);
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Successfully fixed colors in: ${filePath}`);
    }
  } catch (e) {
    console.error(`Error processing file: ${filePath}`, e);
  }
}

console.log('--- STARTING TAILWIND COLOR NORMALIZER ---');
const srcDir = path.join(__dirname, 'src');
if (fs.existsSync(srcDir)) {
  walkDir(srcDir, fixColorsInFile);
  console.log('--- COLOR NORMALIZATION COMPLETED SUCCESSFULLY ---');
} else {
  console.error('Source directory "src" not found.');
}
