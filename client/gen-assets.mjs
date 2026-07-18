import sharp from 'sharp';
const OUT = new URL('./assets/', import.meta.url).pathname;

// App icon 1024x1024 — full-bleed brand gradient + Fortitude lightning bolt.
// No transparency, no rounded corners (iOS rounds them itself).
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3acfde"/>
      <stop offset="0.55" stop-color="#17b4c7"/>
      <stop offset="1" stop-color="#0e7d8f"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.55">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#g)"/>
  <rect width="1024" height="1024" fill="url(#glow)"/>
  <g transform="translate(512,512) scale(30) translate(-12,-12)">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
      fill="#070b14" stroke="#070b14" stroke-width="1.4" stroke-linejoin="round"/>
  </g>
</svg>`;

// Splash 2732x2732 — dark control-room background + centered brand mark.
const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0d1220"/>
      <stop offset="1" stop-color="#070b14"/>
    </linearGradient>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3acfde"/>
      <stop offset="1" stop-color="#0e7d8f"/>
    </linearGradient>
    <radialGradient id="amb" cx="0.5" cy="0.4" r="0.5">
      <stop offset="0" stop-color="#17b4c7" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#17b4c7" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="2732" height="2732" fill="url(#bg)"/>
  <rect width="2732" height="2732" fill="url(#amb)"/>
  <g transform="translate(1366,1230)">
    <rect x="-150" y="-150" width="300" height="300" rx="72" fill="url(#g)"/>
    <g transform="scale(9) translate(-12,-12)">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="#070b14" stroke="#070b14" stroke-width="1.2" stroke-linejoin="round"/>
    </g>
  </g>
  <text x="1366" y="1560" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="150" fill="#e6eaf2" letter-spacing="2">Fortitude</text>
  <text x="1366" y="1650" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="400" font-size="60" fill="#6c7893" letter-spacing="14">DOMOTICA KNX</text>
</svg>`;

await sharp(Buffer.from(icon)).png().toFile(`${OUT}/icon.png`);
await sharp(Buffer.from(splash)).png().toFile(`${OUT}/splash.png`);
await sharp(Buffer.from(splash)).png().toFile(`${OUT}/splash-dark.png`);
// anteprima piccola per farla vedere ad Alex
await sharp(Buffer.from(icon)).resize(256, 256).png().toFile(`${OUT}/icon-preview.png`);
console.log('generati: icon.png (1024), splash.png + splash-dark.png (2732), icon-preview.png (256)');
