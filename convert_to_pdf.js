// Convert to PDF script designed to bypass file locks and ensure it prints
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function mdToHtml(md) {
  let html = md;
  html = html.replace(/```(\w*)\r?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/^\*\*\*$/gm, '<hr>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/^(?!<[huptlboa]|%%CODE)(.+)$/gm, '<p>$1</p>');
  html = html.replace(/<p>\s*<\/p>/g, '');
  return html;
}

const CSS = `
@page { margin: 1in; size: A4; }
* { box-sizing: border-box; }
body { font-family: "Times New Roman", Times, serif; font-size: 11pt; line-height: 1.5; color: #000; text-align: justify; }
h1 { font-size: 16pt; font-weight: bold; text-align: center; margin: 24pt 0; text-transform: uppercase; }
h2 { font-size: 13pt; font-weight: bold; margin: 18pt 0 12pt; border-bottom: 1px solid #000; padding-bottom: 2px; }
h3 { font-size: 11pt; font-weight: bold; margin: 14pt 0 8pt; }
p { margin: 6pt 0; }
hr { border: none; border-top: 1px solid #000; margin: 12pt 0; }
.cover-page { text-align: center; padding-top: 3in; page-break-after: always; }
.cover-page h1 { font-size: 20pt; border: none; text-transform: uppercase; }
.cover-page .subtitle { font-size: 14pt; margin-top: 24pt; }
.cover-page .info { font-size: 11pt; margin-top: 48pt; line-height: 2; text-align: left; display: inline-block; }
.footer-note { display: block; text-align: center; font-style: italic; margin-top: 48pt; font-size: 9pt; }
`;

const docsDir = path.join(__dirname, 'docs');
const htmlFiles = [
  { name: 'Design_Specifications', title: 'Design Specifications Document', subtitle: 'System Architecture & Technical Design' },
  { name: 'User_Manual', title: 'User Manual', subtitle: 'Operations and Usage Guide' },
  { name: 'Implementation_Plan', title: 'Implementation Plan', subtitle: 'Development Strategy & Project Logistics' },
];

const chromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
];
const chromePath = chromePaths.find(p => fs.existsSync(p));

if (!chromePath) process.exit(1);

for (const doc of htmlFiles) {
  const mdFile = path.join(docsDir, doc.name + '.md');
  const htmlFile = path.join(docsDir, doc.name + '.html');
  const pdfFile = path.join(docsDir, doc.name + '_professional.pdf');

  if (!fs.existsSync(mdFile)) {
    console.log("Missing MD:", mdFile);
    continue;
  }

  const mdContent = fs.readFileSync(mdFile, 'utf8');
  let htmlBody = mdToHtml(mdContent);
  const coverPage = '<div class="cover-page"><h1>' + doc.title + '</h1><div class="subtitle">' + doc.subtitle + '</div><div class="info"><p><strong>Project:</strong> VOO Ward Citizen Engagement Platform</p><p><strong>Version:</strong> 2.0.0</p><p><strong>Date:</strong> April 2, 2026</p></div></div>';
  const fullHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' + CSS + '</style></head><body>' + coverPage + htmlBody + '<div class="footer-note"><hr><p>VOO Ward Citizen Engagement Platform — Institutional Document</p></div></body></html>';

  fs.writeFileSync(htmlFile, fullHtml, 'utf8');

  try {
    const fileUrl = 'file:///' + htmlFile.replace(/\\/g, '/');
    execSync('"' + chromePath + '" --headless --disable-gpu --no-sandbox --print-to-pdf="' + pdfFile + '" --print-to-pdf-no-header "' + fileUrl + '"', { stdio: 'inherit' });
    console.log("Created", pdfFile);
  } catch (err) {
    console.error("Failed on", pdfFile, err.message);
  }
}
