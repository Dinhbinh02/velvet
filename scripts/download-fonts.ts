import fs from 'fs';
import https from 'https';
import path from 'path';

const fontsDir = path.join(process.cwd(), 'public', 'fonts');
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

// Chrome macOS User-Agent to ensure Google Fonts returns .woff2 files
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const googleCssUrls = [
  'https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,700;1,7..72,400;1,7..72,700&display=swap',
  'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,700;1,8..60,400;1,8..60,700&display=swap',
  'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400;1,700&display=swap',
  'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,700;1,400;1,700&display=swap',
  'https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&display=swap',
  'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400;1,700&display=swap',
  'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,700;1,14..32,400;1,14..32,700&display=swap'
];

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve());
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('Downloading Google Fonts WOFF2 directly from Google Font CDN...');
  let fullCss = '';

  for (const url of googleCssUrls) {
    const css = await fetchText(url);
    fullCss += '\n' + css;
  }

  // Parse font-face rules and download each unique WOFF2
  const fontFaceRegex = /@font-face\s*\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  let fontIndex = 0;
  let localCss = '';

  while ((match = fontFaceRegex.exec(fullCss)) !== null) {
    const block = match[1];
    const familyMatch = block.match(/font-family:\s*['"]?([^'";]+)['"]?/);
    const styleMatch = block.match(/font-style:\s*([^;]+);/);
    const weightMatch = block.match(/font-weight:\s*([^;]+);/);
    const srcMatch = block.match(/src:\s*url\((https:\/\/[^)]+)\)\s*format\('([^']+)'\)/);
    const unicodeMatch = block.match(/unicode-range:\s*([^;]+);/);

    if (familyMatch && srcMatch) {
      const family = familyMatch[1].trim();
      const style = styleMatch ? styleMatch[1].trim() : 'normal';
      const weight = weightMatch ? weightMatch[1].trim() : '400';
      const remoteUrl = srcMatch[1];
      const format = srcMatch[2];
      const unicode = unicodeMatch ? unicodeMatch[1].trim() : '';

      const safeFamily = family.replace(/\s+/g, '_').toLowerCase();
      const fileName = `${safeFamily}_${style}_${weight.replace(/\s+/g, '')}_${fontIndex++}.woff2`;
      const filePath = path.join(fontsDir, fileName);

      console.log(`Downloading ${family} (${style} ${weight}) -> ${fileName}`);
      await downloadFile(remoteUrl, filePath);

      localCss += `@font-face {
  font-family: '${family}';
  font-style: ${style};
  font-weight: ${weight};
  font-display: swap;
  src: url('/fonts/${fileName}') format('${format}');
  ${unicode ? `unicode-range: ${unicode};` : ''}
}\n`;
    }
  }

  fs.writeFileSync(path.join(fontsDir, 'fonts.css'), localCss);
  console.log('Successfully saved fonts and generated public/fonts/fonts.css!');
}

run().catch(console.error);
