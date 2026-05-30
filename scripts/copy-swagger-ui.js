/**
 * Copy Swagger UI dist files to public folder
 * Run: npm run setup:swagger
 */

const fs = require('fs')
const path = require('path')

const sourceDir = path.join(__dirname, '..', 'node_modules', 'swagger-ui-dist')
const targetDir = path.join(__dirname, '..', 'public', 'docs', 'swagger-ui')

const filesToCopy = [
  'swagger-ui-bundle.js',
  'swagger-ui-standalone-preset.js',
  'swagger-ui.css'
]

// Create target directory if not exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true })
  console.log('Created directory:', targetDir)
}

// Check if swagger-ui-dist is installed
if (!fs.existsSync(sourceDir)) {
  console.error('❌ swagger-ui-dist not found. Run: npm install swagger-ui-dist --save-dev')
  process.exit(1)
}

// Copy files
let copied = 0
for (const file of filesToCopy) {
  const sourcePath = path.join(sourceDir, file)
  const targetPath = path.join(targetDir, file)
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath)
    console.log(`✅ Copied: ${file}`)
    copied++
  } else {
    console.warn(`⚠️ File not found: ${file}`)
  }
}

console.log(`\n✅ Done! ${copied}/${filesToCopy.length} files copied to public/docs/swagger-ui/`)
console.log('Access Swagger UI at: http://localhost:3000/docs/index.html')
