from PIL import Image, ImageDraw, ImageFilter
import os, math

base = r"C:\Users\shlom\Desktop\Qr_Code\cocktail-demo\public\cocktail"
os.makedirs(base, exist_ok=True)

W, H = 800, 1000

def save(name, img):
    img.save(os.path.join(base, name))
    print(f"Created {name}: {img.size}")

# 1. Glass
glass = Image.new('RGBA', (W, H), (0,0,0,0))
d = ImageDraw.Draw(glass)
d.rounded_rectangle([200, 250, 600, 800], radius=30, fill=(200, 200, 210, 80), outline=(220, 220, 230, 150), width=3)
d.ellipse([190, 230, 610, 290], fill=(220, 220, 230, 100), outline=(240, 240, 250, 180), width=2)
d.rounded_rectangle([280, 790, 520, 830], radius=10, fill=(180, 180, 190, 120), outline=(200, 200, 210, 150), width=2)
save("glass.png", glass)

# 2. Liquid
liquid = Image.new('RGBA', (W, H), (0,0,0,0))
d = ImageDraw.Draw(liquid)
d.rounded_rectangle([220, 400, 580, 780], radius=20, fill=(220, 100, 80, 180))
d.ellipse([240, 350, 560, 450], fill=(230, 110, 85, 150))
for x, y, r in [(180, 380, 15), (620, 360, 12), (170, 420, 10), (630, 400, 8)]:
    d.ellipse([x-r, y-r, x+r, y+r], fill=(225, 105, 80, 140))
liquid = liquid.filter(ImageFilter.GaussianBlur(2))
save("liquid.png", liquid)

# 3. Ice
ice = Image.new('RGBA', (W, H), (0,0,0,0))
d = ImageDraw.Draw(ice)
cubes = [(300, 350, 60), (420, 320, 55), (350, 420, 50), (480, 380, 45), (280, 450, 40), (450, 460, 42)]
for cx, cy, s in cubes:
    d.polygon([(cx, cy-s), (cx+s, cy-s//2), (cx+s, cy+s//2), (cx, cy+s), (cx-s, cy+s//2), (cx-s, cy-s//2)],
              fill=(210, 230, 245, 160), outline=(230, 240, 255, 200), width=2)
    d.line([(cx-s//2, cy-s//3), (cx+s//3, cy-s//2)], fill=(255, 255, 255, 100), width=2)
save("ice.png", ice)

# 4. Lime
lime = Image.new('RGBA', (W, H), (0,0,0,0))
d = ImageDraw.Draw(lime)
cx, cy, r = 400, 280, 70
d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(120, 180, 40, 220), outline=(90, 150, 30, 255), width=3)
inner_r = 55
d.ellipse([cx-inner_r, cy-inner_r, cx+inner_r, cy+inner_r], fill=(160, 210, 80, 200))
for angle in range(0, 360, 45):
    rad = math.radians(angle)
    d.line([(cx, cy), (cx + int(inner_r * math.cos(rad)), cy + int(inner_r * math.sin(rad)))],
           fill=(100, 160, 30, 180), width=2)
cx2, cy2, r2 = 320, 230, 45
d.ellipse([cx2-r2, cy2-r2, cx2+r2, cy2+r2], fill=(130, 190, 50, 200), outline=(100, 160, 35, 240), width=2)
save("lime.png", lime)

# 5. Peel
peel = Image.new('RGBA', (W, H), (0,0,0,0))
d = ImageDraw.Draw(peel)
points = []
for i in range(50):
    x = 350 + i * 3 + int(20 * math.sin(i * 0.3))
    y = 180 + i * 2 + int(15 * math.cos(i * 0.4))
    points.append((x, y))
for i in range(len(points)-1):
    d.line([points[i], points[i+1]], fill=(140, 190, 40, 230), width=8)
points2 = []
for i in range(30):
    x = 380 + i * 2 + int(15 * math.sin(i * 0.5))
    y = 150 + i * 3
    points2.append((x, y))
for i in range(len(points2)-1):
    d.line([points2[i], points2[i+1]], fill=(160, 200, 60, 210), width=6)
save("peel.png", peel)

# 6. Straw
straw = Image.new('RGBA', (W, H), (0,0,0,0))
d = ImageDraw.Draw(straw)
d.line([(420, 100), (440, 750)], fill=(180, 140, 100, 220), width=6)
d.line([(421, 100), (441, 750)], fill=(200, 160, 120, 100), width=2)
save("straw.png", straw)

# 7. Full composite
full = Image.new('RGBA', (W, H), (0,0,0,0))
for layer in [glass, liquid, ice, lime, peel, straw]:
    full = Image.alpha_composite(full, layer)
save("full_cocktail.png", full)

print("\nAll 7 assets created!")
