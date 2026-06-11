import numpy as np
from PIL import Image

im = Image.open('public/Food/truffle-burger-exploded.png').convert('RGB')
a = np.asarray(im).astype(int)
H, W, _ = a.shape

# Food lives in x:[20,560]; labels are at x>=627. Vertical bands per component (top->bottom).
FX0, FX1 = 20, 565
bands = {
    'bun':          (208, 466),   # iconic sesame top bun
    'aioli':        (476, 648),   # creamy truffle sauce
    'sweet-potato': (658, 822),   # orange straws
    'lettuce':      (828, 986),   # green leaf
    'patty':        (998, 1186),  # seared beef
}

for name, (y0, y1) in bands.items():
    sub = a[y0:y1, FX0:FX1, :]
    val = sub.max(2)
    content = val > 42
    ys, xs = np.where(content)
    if len(xs) == 0:
        print('EMPTY', name); continue
    pad = 14
    ax0 = FX0 + max(0, int(xs.min()) - pad)
    ax1 = FX0 + min(FX1 - FX0, int(xs.max()) + pad)
    ay0 = y0 + max(0, int(ys.min()) - pad)
    ay1 = y0 + min(y1 - y0, int(ys.max()) + pad)
    crop = im.crop((ax0, ay0, ax1, ay1))
    out = f'public/Food/comp-{name}.png'
    crop.save(out)
    print(f'{name}: {crop.size[0]}x{crop.size[1]}  bbox=({ax0},{ay0},{ax1},{ay1})')
