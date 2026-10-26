async (page) => {
  await page.waitForFunction(() => window.campusSpriteReady === true);
  const manifest = {};
  for (const id of ['v-456', 'v-10', 'v-891', 'v-1112', 'v-south']) {
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
      if (manifest[id] && JSON.stringify(manifest[id]) !== JSON.stringify(metadata))
        throw Error(id + ' day/night frame differs');
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
  console.log('Exported 10 transparent views with stable ground anchors.');
};
