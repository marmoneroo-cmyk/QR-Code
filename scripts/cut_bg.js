// Remove the photo background from the burger hero + each component crop so they
// float on the black page like the cocktail PNGs (transparent, no floor/reflection).
const fs = require('fs');
const { removeBackground } = require('@imgly/background-removal-node');
let sharp = null;
try { sharp = require('sharp'); } catch {}

const DIR = 'public/Food';
const files = [
  ['truffle-burger.png', 'truffle-burger-cut.png'],
  ['comp-bun.png', 'comp-bun-cut.png'],
  ['comp-aioli.png', 'comp-aioli-cut.png'],
  ['comp-sweet-potato.png', 'comp-sweet-potato-cut.png'],
  ['comp-lettuce.png', 'comp-lettuce-cut.png'],
  ['comp-patty.png', 'comp-patty-cut.png'],
];

(async () => {
  for (const [inp, outp] of files) {
    const t0 = Date.now();
    const blob = new Blob([fs.readFileSync(`${DIR}/${inp}`)], { type: 'image/png' });
    const cut = await removeBackground(blob);
    let buf = Buffer.from(await cut.arrayBuffer());
    if (sharp) {
      try { buf = await sharp(buf).trim({ threshold: 12 }).png().toBuffer(); } catch {}
    }
    fs.writeFileSync(`${DIR}/${outp}`, buf);
    console.log(`${outp}  ${(buf.length / 1024).toFixed(0)}KB  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  console.log('DONE');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
