"""사진에서 캐릭터 다섯을 잘라 흰 배경을 지웁니다.

- 덩어리 사이의 중간에서 자릅니다. 하트·반짝임·빗줄기 같은 장식이
  본체 옆으로 나와 있어서, 본체 경계에서 자르면 장식이 잘립니다.
- 다섯 모두 같은 캔버스에 얹어 몸통 크기가 서로 어긋나지 않게 합니다.
"""
import os
from PIL import Image

SRC = r'C:\Users\yejun\Downloads\791013068_1714582029650602_3162880292746542399_n.jpg'
ROOT = r'C:\Users\yejun\projects\harukong'
OUT = os.path.join(ROOT, 'moods')
NAMES = ['veryhappy', 'happy', 'neutral', 'sad', 'verysad']

os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert('RGBA')
W, H = im.size
px = im.load()

HARD, SOFT = 246, 216
for y in range(H):
    for x in range(W):
        r, g, b, a = px[x, y]
        m, lo = max(r, g, b), min(r, g, b)
        if m >= SOFT and (m - lo) <= 18:      # 밝고 무채색이면 배경
            if m >= HARD:
                px[x, y] = (255, 255, 255, 0)
            else:
                t = (m - SOFT) / float(HARD - SOFT)
                px[x, y] = (r, g, b, int(255 * (1 - t)))

ap = im.getchannel('A').load()
cols = [sum(1 for y in range(0, H, 2) if ap[x, y] > 200) for x in range(W)]
thresh = max(cols) * 0.45

bodies, start, gap = [], None, 0
for x, v in enumerate(cols):
    if v > thresh:
        if start is None:
            start = x
        gap = 0
    elif start is not None:
        gap += 1
        if gap > 26:
            bodies.append((start, x - gap))
            start, gap = None, 0
if start is not None:
    bodies.append((start, W - 1))
bodies = [b for b in bodies if b[1] - b[0] > 40]
assert len(bodies) == 5, bodies
print('본체 위치:', bodies)

# 본체 사이의 중간을 경계로 삼아 장식까지 각자에게 붙입니다
cuts = [0]
for i in range(4):
    cuts.append((bodies[i][1] + bodies[i + 1][0]) // 2)
cuts.append(W)
slices = [(cuts[i], cuts[i + 1]) for i in range(5)]
print('자를 구간:', slices)

# 세로는 다섯 전체의 내용 범위로 통일해 눈높이를 맞춥니다
full = im.getbbox()
top, bottom = max(0, full[1] - 8), min(H, full[3] + 8)
band = bottom - top

crops = [im.crop((x0, top, x1, bottom)) for x0, x1 in slices]
side = max(band, max(c.width for c in crops))
print('공통 캔버스:', side)

for name, crop in zip(NAMES, crops):
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2), crop)
    canvas = canvas.resize((360, 360), Image.LANCZOS)
    path = os.path.join(OUT, name + '.png')
    canvas.save(path, optimize=True)
    print(f'  {name:10} {os.path.getsize(path) // 1024}KB')

# 앱 아이콘: 기쁨 캐릭터를 배경 위에 얹습니다
icon = Image.new('RGBA', (512, 512), (251, 252, 254, 255))
ch = Image.open(os.path.join(OUT, 'happy.png')).resize((430, 430), Image.LANCZOS)
icon.paste(ch, (41, 41), ch)
icon.save(os.path.join(ROOT, 'icon.png'), optimize=True)
print('icon.png', os.path.getsize(os.path.join(ROOT, 'icon.png')) // 1024, 'KB')

print('\n대표 색:')
for name, (x0, x1) in zip(NAMES, bodies):
    crop = im.crop((x0, 0, x1, H))
    cp, counts = crop.load(), {}
    for y in range(0, crop.height, 3):
        for x in range(0, crop.width, 3):
            r, g, b, a = cp[x, y]
            if a < 250:
                continue
            counts[(r // 6 * 6, g // 6 * 6, b // 6 * 6)] = counts.get((r // 6 * 6, g // 6 * 6, b // 6 * 6), 0) + 1
    (r, g, b), _ = sorted(counts.items(), key=lambda kv: -kv[1])[0]
    print(f"  {name:10} #{r:02X}{g:02X}{b:02X}")
