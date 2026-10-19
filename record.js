const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function injectCursor(page) {
  return page.evaluate(() => {
    const cursor = document.createElement('div');
    cursor.id = 'virtual-cursor';
    cursor.style.position = 'fixed';
    cursor.style.left = '50%';
    cursor.style.top = '25%';
    cursor.style.width = '24px';
    cursor.style.height = '24px';
    cursor.style.borderRadius = '50%';
    cursor.style.backgroundColor = 'rgba(6, 182, 212, 0.45)';
    cursor.style.border = '2px solid rgba(255, 255, 255, 0.9)';
    cursor.style.boxShadow = '0 0 15px rgba(6, 182, 212, 0.8), 0 2px 5px rgba(0,0,0,0.4)';
    cursor.style.pointerEvents = 'none';
    cursor.style.zIndex = '999999';
    cursor.style.transform = 'translate(-50%, -50%)';
    cursor.style.transition = 'transform 0.14s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.15s ease';
    document.body.appendChild(cursor);

    window.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    });

    window.addEventListener('mousedown', () => {
      cursor.style.transform = 'translate(-50%, -50%) scale(0.65)';
      cursor.style.backgroundColor = 'rgba(59, 130, 246, 0.8)';
    });
    window.addEventListener('mouseup', () => {
      cursor.style.transform = 'translate(-50%, -50%) scale(1)';
      cursor.style.backgroundColor = 'rgba(6, 182, 212, 0.45)';
    });
  });
}

(async () => {
  const dir = __dirname;
  const tempDir = path.join(dir, 'temp-record');
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const fileUrl = 'file://' + path.join(dir, 'index.html');

  // ==========================================
  // 1. DESKTOP RECORDING (1200x900)
  // ==========================================
  console.log('--- [02] Recording Desktop Version ---');
  const desktopVideoDir = path.join(tempDir, 'desktop');
  fs.mkdirSync(desktopVideoDir);

  const desktopContext = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    deviceScaleFactor: 2,
    recordVideo: { dir: desktopVideoDir, size: { width: 1200, height: 900 } }
  });

  const dPage = await desktopContext.newPage();
  await dPage.goto(fileUrl);
  await dPage.waitForTimeout(600);

  // Screenshot Desktop
  await dPage.screenshot({ path: path.join(dir, 'screenshot-desktop.png') });
  console.log('Saved screenshot-desktop.png');

  await injectCursor(dPage);
  await dPage.mouse.move(600, 180);
  await dPage.waitForTimeout(400);

  // Hover Projects -> Dropdown Popover
  const projectsBtn = await dPage.$('#projectsBtn');
  const projBox = await projectsBtn.boundingBox();
  if (projBox) {
    await dPage.mouse.move(projBox.x + projBox.width / 2, projBox.y + projBox.height / 2, { steps: 18 });
    await dPage.waitForTimeout(400);

    // Hover inside popover over project items
    await dPage.mouse.move(projBox.x + 80, projBox.y + 60, { steps: 14 });
    await dPage.waitForTimeout(450);
    await dPage.mouse.move(projBox.x + 80, projBox.y + 115, { steps: 14 });
    await dPage.waitForTimeout(450);
  }

  // Move across tabs
  const tabs = await dPage.$$('.nav-tab');
  for (let i = 1; i < tabs.length; i++) {
    const box = await tabs[i].boundingBox();
    if (box) {
      await dPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
      await dPage.waitForTimeout(300);
    }
  }

  // Click ⌘K Search Trigger -> Opens Command Palette
  const searchBtn = await dPage.$('#commandKTrigger');
  const sBox = await searchBtn.boundingBox();
  if (sBox) {
    await dPage.mouse.move(sBox.x + sBox.width / 2, sBox.y + sBox.height / 2, { steps: 18 });
    await dPage.waitForTimeout(250);
    await dPage.mouse.down();
    await dPage.waitForTimeout(100);
    await dPage.mouse.up();
    await dPage.waitForTimeout(700);

    // Type in search bar
    await dPage.type('#commandInput', 'air', { delay: 100 });
    await dPage.waitForTimeout(600);

    // Close with Escape
    await dPage.keyboard.press('Escape');
    await dPage.waitForTimeout(500);
  }

  // Toggle Theme (White mode)
  const themeBtn = await dPage.$('#themeToggleBtn');
  const themeBox = await themeBtn.boundingBox();
  if (themeBox) {
    await dPage.mouse.move(themeBox.x + themeBox.width / 2, themeBox.y + themeBox.height / 2, { steps: 18 });
    await dPage.waitForTimeout(250);
    await dPage.mouse.down();
    await dPage.waitForTimeout(100);
    await dPage.mouse.up();
    await dPage.waitForTimeout(700);

    // Toggle back to Dark mode
    await dPage.mouse.down();
    await dPage.waitForTimeout(100);
    await dPage.mouse.up();
    await dPage.waitForTimeout(600);
  }

  await dPage.close();
  await desktopContext.close();

  // Convert desktop video
  const dVideos = fs.readdirSync(desktopVideoDir).filter(f => f.endsWith('.webm'));
  if (dVideos.length > 0) {
    execSync(`ffmpeg -y -i "${path.join(desktopVideoDir, dVideos[0])}" -c:v libx264 -pix_fmt yuv420p -r 30 -b:v 2M "${path.join(dir, 'video-desktop.mp4')}"`);
    console.log('Saved video-desktop.mp4');
  }

  // ==========================================
  // 2. MOBILE RECORDING (390x844 iPhone View)
  // ==========================================
  console.log('--- [02] Recording Mobile Version ---');
  const mobileVideoDir = path.join(tempDir, 'mobile');
  fs.mkdirSync(mobileVideoDir);

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: mobileVideoDir, size: { width: 390, height: 844 } }
  });

  const mPage = await mobileContext.newPage();
  await mPage.goto(fileUrl);
  await mPage.waitForTimeout(600);

  // Screenshot Mobile
  await mPage.screenshot({ path: path.join(dir, 'screenshot-mobile.png') });
  console.log('Saved screenshot-mobile.png');

  try {
    await injectCursor(mPage);
    await mPage.mouse.move(195, 200);
    await mPage.waitForTimeout(400);

    // Tap Mobile Menu Toggle
    const mNavBtn = await mPage.$('#mobileNavBtn');
    const mnBox = await mNavBtn.boundingBox();
    if (mnBox) {
      await mPage.mouse.move(mnBox.x + mnBox.width / 2, mnBox.y + mnBox.height / 2, { steps: 16 });
      await mPage.waitForTimeout(200);
      await mPage.mouse.down();
      await mPage.waitForTimeout(100);
      await mPage.mouse.up();
      await mPage.waitForTimeout(700); // Mobile drawer opened!
    }

    // Hover through project cards in drawer
    const mLinks = await mPage.$$('.mobile-link');
    for (const mLink of mLinks.slice(0, 2)) {
      const box = await mLink.boundingBox();
      if (box) {
        await mPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 14 });
        await mPage.waitForTimeout(350);
      }
    }

    // Tap Search bar trigger in mobile drawer -> Opens Command Palette Popup!
    const mSearchTrigger = await mPage.$('#mobileSearchInputTrigger');
    const msBox = await mSearchTrigger.boundingBox();
    if (msBox) {
      await mPage.mouse.move(msBox.x + msBox.width / 2, msBox.y + msBox.height / 2, { steps: 16 });
      await mPage.waitForTimeout(250);
      await mPage.mouse.down();
      await mPage.waitForTimeout(100);
      await mPage.mouse.up();
      await mPage.waitForTimeout(800); // Command Palette opened on mobile!

      // Type in search bar
      await mPage.type('#commandInput', 'ar', { delay: 100 });
      await mPage.waitForTimeout(600);

      // Close modal with Escape
      await mPage.keyboard.press('Escape');
      await mPage.waitForTimeout(600);
    }

    // Tap theme toggle on mobile
    const mThemeBtn = await mPage.$('#themeToggleBtn');
    const mtBox = await mThemeBtn.boundingBox();
    if (mtBox) {
      await mPage.mouse.move(mtBox.x + mtBox.width / 2, mtBox.y + mtBox.height / 2, { steps: 16 });
      await mPage.waitForTimeout(200);
      await mPage.mouse.down();
      await mPage.waitForTimeout(100);
      await mPage.mouse.up();
      await mPage.waitForTimeout(700); // White canvas

      // Toggle theme back to Dark
      await mPage.mouse.down();
      await mPage.waitForTimeout(100);
      await mPage.mouse.up();
      await mPage.waitForTimeout(600);
    }

  } catch (err) {
    console.error('Error during mobile recording:', err);
  }

  await mPage.close();
  await mobileContext.close();
  await browser.close();

  // Convert mobile video
  const mVideos = fs.readdirSync(mobileVideoDir).filter(f => f.endsWith('.webm'));
  if (mVideos.length > 0) {
    execSync(`ffmpeg -y -i "${path.join(mobileVideoDir, mVideos[0])}" -c:v libx264 -pix_fmt yuv420p -r 30 -b:v 2M "${path.join(dir, 'video-mobile.mp4')}"`);
    console.log('Saved video-mobile.mp4');
  }

  // Cleanup temp files
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('02 Desktop & Mobile assets recorded successfully!');
})();
