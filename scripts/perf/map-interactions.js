// Playwright CLI run-code expression. Open the production preview before running.
// Reports browser-emulated touch performance; this is not a physical-phone benchmark.
async function benchmarkMap(page) {
  await page.addInitScript(() => {
    if (window.__perfInstalled) return;
    window.__perfInstalled = true;
    window.__commits = 0;
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      inject: () => 1,
      onCommitFiberRoot: () => window.__commits++,
      onCommitFiberUnmount: () => {},
    };
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const metrics = async () =>
    Object.fromEntries(
      (await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]),
    );
  const start = async () => {
    await page.evaluate(() => {
      window.__commits = 0;
      window.__samples = [];
      window.__mutations = { world: 0, paths: 0, child: 0 };
      let last = performance.now();
      window.__running = true;
      const tick = (t) => {
        if (!window.__running) return;
        window.__samples.push(t - last);
        last = t;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      window.__observer = new MutationObserver((ms) =>
        ms.forEach((m) => {
          if (m.type === 'childList') window.__mutations.child++;
          if (m.attributeName === 'd') window.__mutations.paths++;
          if (m.attributeName === 'transform' && m.target.hasAttribute('data-geo-world'))
            window.__mutations.world++;
        }),
      );
      window.__observer.observe(document.querySelector('.geo-campus-map'), {
        subtree: true,
        attributes: true,
        childList: true,
      });
    });
    return metrics();
  };
  const finish = async (before) => {
    const after = await metrics();
    const dom = await page.evaluate(() => {
      window.__running = false;
      window.__observer.disconnect();
      const s = window.__samples.sort((a, b) => a - b);
      return {
        commits: window.__commits,
        mutations: window.__mutations,
        frames: s.length,
        p95: s[Math.floor(s.length * 0.95)],
        over50: s.filter((x) => x > 50).length,
        paths: document.querySelectorAll('.geo-campus-map path').length,
      };
    });
    return {
      ...dom,
      taskMs: 1000 * (after.TaskDuration - before.TaskDuration),
      scriptMs: 1000 * (after.ScriptDuration - before.ScriptDuration),
      layoutMs: 1000 * (after.LayoutDuration - before.LayoutDuration),
      styleMs: 1000 * (after.RecalcStyleDuration - before.RecalcStyleDuration),
    };
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.waitForSelector('.geo-campus-map[data-priority-ready="true"]');
  await page.waitForSelector('.geo-campus-map[data-periphery-cached="true"]', { timeout: 60000 });
  await page.mouse.move(220, 360);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(700);
  const beforePan = await start();
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 200, y: 350 }],
  });
  for (let i = 1; i <= 36; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: 200 + 80 * Math.sin((i / 36) * Math.PI * 2),
          y: 350 + 40 * Math.cos((i / 36) * Math.PI * 2),
        },
      ],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(250);
  const pan = await finish(beforePan);
  const beforePinch = await start();
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: 130, y: 350, id: 1 },
      { x: 260, y: 350, id: 2 },
    ],
  });
  for (let i = 1; i <= 36; i++) {
    const d = 65 + 22 * Math.sin((i / 36) * Math.PI * 2);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: 195 - d, y: 350, id: 1 },
        { x: 195 + d, y: 350, id: 2 },
      ],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(250);
  const pinch = await finish(beforePinch);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await page.waitForSelector('.geo-campus-map[data-priority-ready="true"]');
  await page.waitForTimeout(700);
  const beforeHeader = await start();
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(720, 5);
    await page.waitForTimeout(350);
    await page.mouse.move(900, 450);
    await page.waitForTimeout(350);
  }
  const header = await finish(beforeHeader);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await cdp.detach();
  return { pan, pinch, header };
}
