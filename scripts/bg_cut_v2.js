// Remove the black background from each cropped component (comp-*-src.png) and
// trim -> transparent floating PNG. Same working pattern as cut_bg.js (no sharp.extract).
const fs = require('fs');
const { removeBackground } = require('@imgly/background-removal-node');
let sharp = null; try { sharp = require('sharp'); } catch {}

const names = ['bun', 'aioli', 'sweet-potato', 'lettuce', 'patty'];

(async () => {
  for (const name of names) {
    const src = `public/Food/comp-${name}-src.png`;
    if (!fs.existsSync(src)) { console.log(`${name}: missing ${src}`); continue; }
    const blob = new Blob([fs.readFileSync(src)], { type: 'image/png' });
    let buf = Buffer.from(await (await removeBackground(blob)).arrayBuffer());
    if (sharp) { try { buf = await sharp(buf).trim({ threshold: 12 }).png().toBuffer(); } catch {} }
    fs.writeFileSync(`public/Food/comp-${name}-cut.png`, buf);
    console.log(`${name}: ${(buf.length / 1024).toFixed(0)}KB`);
  }
  console.log('DONE');
})().catch((e) => { console.log('ERR', e.message); process.exit(1); });
