/**
 * Convert Markdown documents to professional PDF files
 * Uses marked for markdown parsing and puppeteer for PDF generation
 */

const fs = require('fs');
const path = require('path');

// Simple markdown to HTML converter (no external deps needed)
function mdToHtml(md) {
  let html = md;

  // Escape HTML entities in code blocks first (protect them)
  const codeBlocks = [];
  html = html.replace(/```(\w*)\r?\n([\s\S]*?)```/g, (match, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang, code: code.replace(/</g, '&lt;').replace(/>/g, '&gt;') });
    return `%%CODEBLOCK_${idx}%%`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/^\*\*\*$/gm, '<hr>');

  // Tables
  html = html.replace(/^(\|.+\|)\r?\n(\|[-| :]+\|)\r?\n((?:\|.+\|\r?\n?)*)/gm, (match, header, sep, body) => {
    const headers = header.split('|').filter(h => h.trim()).map(h => `<th>${h.trim()}</th>`).join('');
    const rows = body.trim().split('\n').map(row => {
      const cells = row.split('|').filter(c => c.trim() !== '' || c.includes(' ')).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // Blockquotes
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
  // Merge adjacent blockquotes
  html = html.replace(/<\/blockquote>\s*<blockquote>/g, '<br>');

  // Unordered lists
  html = html.replace(/^(\s*)-\s+(.+)$/gm, (match, indent, content) => {
    const level = Math.floor(indent.length / 2);
    return `<li class="level-${level}">${content}</li>`;
  });

  // Wrap consecutive <li> elements in <ul>
  html = html.replace(/((?:<li[^>]*>.*<\/li>\s*)+)/g, '<ul>$1</ul>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Paragraphs - wrap text blocks
  html = html.replace(/^(?!<[huptlboa]|%%CODE)(.+)$/gm, '<p>$1</p>');

  // Remove empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  // Restore code blocks
  codeBlocks.forEach((block, idx) => {
    html = html.replace(`%%CODEBLOCK_${idx}%%`,
      `<pre><code class="language-${block.lang}">${block.code}</code></pre>`);
  });

  return html;
}

const CSS = `
@page {
  margin: 2cm 2.5cm;
  size: A4;
  @bottom-center {
    content: counter(page);
    font-size: 10px;
    color: #666;
  }
}

* {
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.6;
  color: #1a1a1a;
  max-width: 100%;
  padding: 0;
  margin: 0;
}

h1 {
  font-size: 22pt;
  font-weight: 700;
  color: #1a365d;
  border-bottom: 3px solid #2b6cb0;
  padding-bottom: 8px;
  margin-top: 24px;
  margin-bottom: 16px;
  page-break-after: avoid;
}

h2 {
  font-size: 16pt;
  font-weight: 600;
  color: #2c5282;
  border-bottom: 1.5px solid #bee3f8;
  padding-bottom: 6px;
  margin-top: 28px;
  margin-bottom: 12px;
  page-break-after: avoid;
}

h3 {
  font-size: 13pt;
  font-weight: 600;
  color: #2d3748;
  margin-top: 20px;
  margin-bottom: 8px;
  page-break-after: avoid;
}

h4 {
  font-size: 11.5pt;
  font-weight: 600;
  color: #4a5568;
  margin-top: 16px;
  margin-bottom: 6px;
  page-break-after: avoid;
}

p {
  margin: 6px 0;
  text-align: justify;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  font-size: 10pt;
  page-break-inside: avoid;
}

th {
  background-color: #2b6cb0;
  color: white;
  font-weight: 600;
  text-align: left;
  padding: 8px 10px;
  border: 1px solid #2b6cb0;
}

td {
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  vertical-align: top;
}

tr:nth-child(even) {
  background-color: #f7fafc;
}

tr:hover {
  background-color: #edf2f7;
}

pre {
  background-color: #1a202c;
  color: #e2e8f0;
  padding: 14px 18px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 9pt;
  line-height: 1.5;
  margin: 12px 0;
  page-break-inside: avoid;
}

code {
  font-family: 'Cascadia Code', 'Consolas', 'Courier New', monospace;
  font-size: 9.5pt;
}

p code, li code, td code {
  background-color: #edf2f7;
  color: #c53030;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 9.5pt;
}

blockquote {
  border-left: 4px solid #3182ce;
  padding: 10px 16px;
  margin: 12px 0;
  background-color: #ebf8ff;
  color: #2c5282;
  border-radius: 0 4px 4px 0;
  font-style: italic;
}

ul {
  padding-left: 20px;
  margin: 6px 0;
}

li {
  margin: 3px 0;
}

hr {
  border: none;
  border-top: 2px solid #e2e8f0;
  margin: 24px 0;
}

a {
  color: #2b6cb0;
  text-decoration: none;
}

strong {
  color: #1a202c;
}

.cover-page {
  text-align: center;
  padding-top: 200px;
  page-break-after: always;
}

.cover-page h1 {
  font-size: 28pt;
  border: none;
  color: #1a365d;
}

.cover-page .subtitle {
  font-size: 18pt;
  color: #2c5282;
  margin-top: 20px;
}

.cover-page .info {
  font-size: 12pt;
  color: #4a5568;
  margin-top: 40px;
  line-height: 2;
}

.footer-note {
  text-align: center;
  font-style: italic;
  color: #718096;
  margin-top: 40px;
  font-size: 10pt;
}
`;

async function convertToPDF(mdFile, pdfFile, title, subtitle) {
  console.log(`📄 Converting: ${path.basename(mdFile)} → ${path.basename(pdfFile)}`);

  const mdContent = fs.readFileSync(mdFile, 'utf8');
  const htmlBody = mdToHtml(mdContent);

  const coverPage = `
    <div class="cover-page">
      <h1>${title}</h1>
      <div class="subtitle">${subtitle}</div>
      <div class="info">
        <p><strong>Project:</strong> VOO Ward (Kyamatu Ward) Citizen Engagement Platform</p>
        <p><strong>Version:</strong> 2.0.0</p>
        <p><strong>Date:</strong> April 2, 2026</p>
        <p><strong>Prepared By:</strong> VOO Ward Development Team</p>
      </div>
    </div>
  `;

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title} - VOO Ward Platform</title>
  <style>${CSS}</style>
</head>
<body>
  ${coverPage}
  ${htmlBody}
  <div class="footer-note">
    <hr>
    <p>VOO Ward Citizen Engagement Platform — Confidential Document</p>
  </div>
</body>
</html>`;

  // Write HTML file
  const htmlFile = pdfFile.replace('.pdf', '.html');
  fs.writeFileSync(htmlFile, fullHtml, 'utf8');
  console.log(`   ✅ HTML generated: ${path.basename(htmlFile)}`);

  // Try to use puppeteer for PDF
  try {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: pdfFile,
      format: 'A4',
      printBackground: true,
      margin: { top: '2cm', bottom: '2cm', left: '2.5cm', right: '2.5cm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: '<div style="text-align:center;width:100%;font-size:9px;color:#999;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'
    });
    await browser.close();
    console.log(`   ✅ PDF generated: ${path.basename(pdfFile)}`);
    return true;
  } catch (e) {
    console.log(`   ⚠️  Puppeteer not available. HTML file ready for manual PDF conversion.`);
    return false;
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   VOO Ward Documentation PDF Generator   ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const docsDir = path.join(__dirname, 'docs');

  const documents = [
    {
      md: path.join(docsDir, 'Design_Specifications.md'),
      pdf: path.join(docsDir, 'Design_Specifications.pdf'),
      title: 'Design Specifications',
      subtitle: 'System Architecture & Technical Design'
    },
    {
      md: path.join(docsDir, 'User_Manual.md'),
      pdf: path.join(docsDir, 'User_Manual.pdf'),
      title: 'User Manual',
      subtitle: 'Complete Usage Guide for All Users'
    },
    {
      md: path.join(docsDir, 'Implementation_Plan.md'),
      pdf: path.join(docsDir, 'Implementation_Plan.pdf'),
      title: 'Implementation Plan',
      subtitle: 'Development Strategy & Project Schedule'
    }
  ];

  let pdfSuccess = 0;
  for (const doc of documents) {
    if (!fs.existsSync(doc.md)) {
      console.log(`❌ File not found: ${doc.md}`);
      continue;
    }
    const ok = await convertToPDF(doc.md, doc.pdf, doc.title, doc.subtitle);
    if (ok) pdfSuccess++;
  }

  console.log('\n' + '═'.repeat(50));
  if (pdfSuccess === documents.length) {
    console.log(`✅ All ${pdfSuccess} PDFs generated successfully!`);
    console.log(`📁 Location: ${docsDir}`);
  } else {
    console.log(`📄 HTML files generated in: ${docsDir}`);
    console.log(`\nTo convert HTML to PDF, open each .html file in your browser`);
    console.log(`and use Ctrl+P → Save as PDF (or Print to PDF).`);
    console.log(`\nAlternatively, install puppeteer: npm install puppeteer`);
    console.log(`Then re-run: node convert_md_to_pdf.js`);
  }
}

main().catch(console.error);
