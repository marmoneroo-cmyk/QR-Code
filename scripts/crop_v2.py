import numpy as np
from PIL import Image

im = Image.open('public/Food/truffle-burger-exploded-v2.png').convert('RGB')
a = np.asarray(im)
H, W, _ = a.shape

FX0, FX1 = 338, 846            # food column (text is on the left)
PAD = 16
# 5 unique layers (dedup the repeated bun & aioli): name -> (yTop, yBottom)
comps = {
    'bun':          (103, 310),   # #1 brioche top
    'aioli':        (385, 533),   # #2 truffle aioli splash
    'sweet-potato': (564, 733),   # #3 sweet-potato straws
    'lettuce':      (768, 927),   # #4 fresh lettuce
    'patty':        (971, 1118),  # #5 grilled beef patty
    'bun-bottom':   (1320, 1483), # #7 brioche bottom
}

for name, (y0, y1) in comps.items():
    top, bot = max(0, y0 - PAD), min(H, y1 + PAD)
    sub = a[top:bot, FX0:FX1, :]
    val = sub.max(2)
    ys, xs = np.where(val > 40)               # tighten to the object's bbox
    if len(xs) == 0:
        print('EMPTY', name); continue
    p = 8
    x0, x1 = max(0, int(xs.min()) - p), min(sub.shape[1], int(xs.max()) + p)
    yy0, yy1 = max(0, int(ys.min()) - p), min(sub.shape[0], int(ys.max()) + p)
    Image.fromarray(sub[yy0:yy1, x0:x1, :]).save(f'public/Food/comp-{name}-src.png')
    print(f'{name}: {x1 - x0}x{yy1 - yy0}')
