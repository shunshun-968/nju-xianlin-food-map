// Playwright CLI evaluates this file as a function expression; keep its closing brace free of a semicolon.
// prettier-ignore
async (page) => {
  await page.waitForFunction(() => window.campusSpriteReady === true);
  const manifest = await page.evaluate(async () => {
    const response = await fetch(
      new URL('../src/assets/campus-models/manifest.json', location.href),
    );
    if (!response.ok) throw Error('Could not load existing sprite manifest');
    return response.json();
  });
  const requested = new URL(page.url()).searchParams.get('only');
  const ids = ['v-456', 'v-10', 'v-891', 'v-1112', 'v-south', 'v-yifu', 'v-hut'];
  if (requested && !ids.includes(requested)) throw Error(`Unknown model: ${requested}`);
  for (const id of requested ? [requested] : ids) {
    let dayMetadata;
    for (const night of [false, true]) {
      const download = page.waitForEvent('download');
      const metadata = await page.evaluate(
        async ({ id, night }) => {
          const result = await window.renderCampusSprite(id, night);
          const a = document.createElement('a');
          a.href = result.dataUrl;
          a.download = `${id}-${night ? 'night' : 'day'}.webp`;
          document.body.append(a);
          a.click();
          a.remove();
          return result.metadata;
        },
        { id, night },
      );
      await (
        await download
      ).saveAs(`src/assets/campus-models/${id}-${night ? 'night' : 'day'}.webp`);
      if (dayMetadata && JSON.stringify(dayMetadata) !== JSON.stringify(metadata))
        throw Error(id + ' day/night frame differs');
      dayMetadata = metadata;
      manifest[id] = metadata;
    }
  }
  const download = page.waitForEvent('download');
  await page.evaluate(
    (content) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
      a.download = 'manifest.json';
      document.body.append(a);
      a.click();
      a.remove();
    },
    JSON.stringify(manifest, null, 2) + '\n',
  );
  await (await download).saveAs('src/assets/campus-models/manifest.json');
  console.log(
    `Exported ${requested ? 2 : ids.length * 2} transparent views with stable ground anchors.`,
  );
}
