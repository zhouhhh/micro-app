const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    args: ['--remote-debugging-port=9222']
  });
  const page = await browser.newPage();
  await page.goto('http://erp.jd.com/');
  console.log(await page.cookies())
  // other actions...
  await browser.close();
})();