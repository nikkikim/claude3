// Prints portfolio.html to a PDF with one 1440x810 spread per page.
// usage: node render_pdf.js <input.html> <output.pdf>   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const [input, output] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  await page.goto('file://' + path.resolve(input), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.pdf({
    path: output, width: '1440px', height: '810px', printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }, preferCSSPageSize: true,
  });
  await browser.close();
})();
