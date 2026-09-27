# Generator grafik marki Matury Online (Karol 27.09.2026).
# HTML z fontami marki (Outfit / DM Sans) → PNG przez headless Chrome.
#   python build.py            # wszystkie
#   python build.py fb_cover   # jeden
import os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "out")
CHROME = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
HERO = "hero.webp"

FONTS = '<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800;900&family=DM+Sans:wght@400;500;700&display=block" rel="stylesheet">'

BASE_CSS = """
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:%(w)dpx;height:%(h)dpx;overflow:hidden}
body{font-family:'DM Sans',sans-serif;color:#0f0d2e;background:#fafafa}
.display{font-family:'Outfit',sans-serif}
/* jak hero na landingu: białe tło, zielona i fioletowa poświata */
.bg{position:absolute;inset:0;background:
  radial-gradient(700px 520px at 88%% 8%%, rgba(34,197,94,.16), transparent 62%%),
  radial-gradient(700px 520px at 6%% 100%%, rgba(99,102,241,.14), transparent 62%%),
  radial-gradient(circle at 50%% 120%%, rgba(99,102,241,.08), transparent 60%%),
  #ffffff}
.grid{position:absolute;inset:0;background-image:
  linear-gradient(rgba(15,13,46,.045) 1px,transparent 1px),
  linear-gradient(90deg,rgba(15,13,46,.045) 1px,transparent 1px);
  background-size:48px 48px;mask-image:radial-gradient(ellipse at 30%% 40%%,#000 25%%,transparent 72%%)}
.mark{position:relative;border-radius:22%%;background:linear-gradient(140deg,#22c55e 0%%,#14b8a6 45%%,#4f46e5 100%%);
  box-shadow:0 18px 50px rgba(34,197,94,.22), inset 0 2px 0 rgba(255,255,255,.35);display:flex;align-items:center;justify-content:center;overflow:hidden}
.mark:before{content:"";position:absolute;inset:0;background:radial-gradient(120%% 80%% at 30%% 0%%,rgba(255,255,255,.28),transparent 55%%)}
.mark .m{position:relative;font-family:'Outfit';font-weight:900;color:#fff;letter-spacing:-.02em;line-height:1;text-shadow:0 6px 24px rgba(15,13,46,.30)}
.mark .ok{position:absolute;border-radius:50%%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(15,13,46,.30)}
.chip{display:inline-flex;align-items:center;gap:10px;padding:10px 18px;border-radius:999px;background:#dcfce7;color:#15803d;font-weight:700;box-shadow:0 6px 20px rgba(15,13,46,.08)}
.dot{width:10px;height:10px;border-radius:50%%;background:#22c55e}
.grad{background:linear-gradient(90deg,#22c55e,#6366f1);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{color:#52525b}
.sub b{color:#18181b}
.photo{position:absolute;background:url(%(hero)s) center 30%%/cover;border-radius:36px;
  box-shadow:0 30px 80px rgba(15,13,46,.22), 0 0 0 1px rgba(15,13,46,.06)}
"""

CHECK = '<svg viewBox="0 0 24 24" width="%(s)d" height="%(s)d"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="#16a34a" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'

def mark(size, radius=True, badge=True):
    b = ""
    if badge:
        d = int(size * 0.30)
        b = f'<div class="ok" style="width:{d}px;height:{d}px;right:{int(size*0.07)}px;bottom:{int(size*0.07)}px">{CHECK % {"s": int(d*0.62)}}</div>'
    r = "" if radius else "border-radius:0;"
    return (f'<div class="mark" style="width:{size}px;height:{size}px;{r}">'
            f'<span class="m" style="font-size:{int(size*0.62)}px;margin-top:-{int(size*0.03)}px">M</span>{b}</div>')

def wordmark(size):
    return (f'<div style="display:flex;align-items:center;gap:{int(size*0.35)}px">{mark(size, badge=False)}'
            f'<div class="display" style="font-weight:800;font-size:{int(size*0.62)}px;letter-spacing:-.01em">Matury <span class="grad">Online</span></div></div>')

def page(w, h, body):
    return f'<!doctype html><html><head><meta charset="utf-8">{FONTS}<style>{BASE_CSS % {"w": w, "h": h, "hero": HERO}}</style></head><body>{body}</body></html>'

DESIGNS = {}

# ── Znak / awatary ─────────────────────────────────────────────────────────
# Awatar (FB/IG/TikTok/YT tną do koła): pełny kwadrat gradientu, znak w środku,
# znaczek ✓ w bezpiecznym polu koła.
DESIGNS["avatar_1080"] = (1080, 1080, page(1080, 1080, f"""
<div class="mark" style="position:absolute;inset:0;border-radius:0">
  <span class="m" style="font-size:600px;margin-top:-40px">M</span>
  <div class="ok" style="width:200px;height:200px;right:150px;bottom:150px">{CHECK % {"s": 130}}</div>
</div>"""))
# Ikona Sklepu Play 512 — pełny kwadrat (Google sam zaokrągla).
DESIGNS["play_icon_512"] = (512, 512, page(512, 512, f"""
<div class="mark" style="position:absolute;inset:0;border-radius:0">
  <span class="m" style="font-size:300px;margin-top:-18px">M</span>
  <div class="ok" style="width:104px;height:104px;right:48px;bottom:48px">{CHECK % {"s": 68}}</div>
</div>"""))
# Logo z zaokrągleniem (strona, materiały) 1024
DESIGNS["logo_1024"] = (1024, 1024, page(1024, 1024, f"""<style>body{{background:transparent}}</style>
<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">{mark(1024)}</div>"""))

# ── Facebook: okładka 1640×624 (widoczna też jako 820×312 i 640×360 na tel.)
# Lewy dolny róg zasłania zdjęcie profilowe na komputerze — tam nic ważnego.
DESIGNS["fb_cover"] = (1640, 624, page(1640, 624, f"""
<div class="bg"></div><div class="grid"></div>
<div class="photo" style="right:150px;top:62px;width:420px;height:500px;transform:rotate(3deg)"></div>
<div style="position:absolute;left:1000px;top:470px" class="chip"><span class="dot"></span>12 przedmiotów · arkusze CKE</div>
<div style="position:absolute;left:330px;top:110px;width:760px">
  {wordmark(64)}
  <h1 class="display" style="font-weight:800;font-size:66px;line-height:1.02;margin-top:34px;letter-spacing:-.02em">Przygotuj się<br>do matury <span class="grad">na 100%</span></h1>
  <p class="sub" style="font-size:25px;margin-top:22px;max-width:640px"><b>Zadania, testy i symulacje egzaminu</b> dla 12&nbsp;przedmiotów — w telefonie i na komputerze.</p>
</div>"""))

# ── YouTube: baner 2560×1440, bezpieczny pas 1546×423 na środku ────────────
DESIGNS["yt_banner"] = (2560, 1440, page(2560, 1440, f"""
<div class="bg"></div><div class="grid"></div>
<div style="position:absolute;left:507px;top:508px;width:1546px;height:423px">
  <div class="photo" style="right:60px;top:18px;width:320px;height:387px;border-radius:30px;transform:rotate(3deg)"></div>
  <div style="position:absolute;left:40px;top:22px;width:1000px">
    {wordmark(62)}
    <h1 class="display" style="font-weight:800;font-size:74px;line-height:1.02;margin-top:26px;letter-spacing:-.02em">Przygotuj się<br>do matury <span class="grad">na 100%</span></h1>
    <p class="sub" style="font-size:26px;margin-top:14px">Nowe filmy co tydzień · <b>zadania, arkusze CKE, wypracowania</b></p>
  </div>
</div>"""))

# ── Sklep Play: grafika wyróżniająca 1024×500 ─────────────────────────────
DESIGNS["play_feature"] = (1024, 500, page(1024, 500, f"""
<div class="bg"></div><div class="grid"></div>
<div class="photo" style="right:56px;top:46px;width:330px;height:410px;border-radius:28px;transform:rotate(3deg)"></div>
<div style="position:absolute;right:300px;top:360px;font-size:16px" class="chip"><span class="dot"></span>Arkusze CKE</div>
<div style="position:absolute;left:56px;top:70px;width:560px">
  {wordmark(52)}
  <h1 class="display" style="font-weight:800;font-size:54px;line-height:1.02;margin-top:28px;letter-spacing:-.02em">Przygotuj się<br>do matury <span class="grad">na 100%</span></h1>
  <p class="sub" style="font-size:19px;margin-top:16px;max-width:470px"><b>Zadania, testy i symulacje egzaminu</b> dla 12&nbsp;przedmiotów.</p>
</div>"""))

def render(name):
    w, h, html = DESIGNS[name]
    src = os.path.join(HERE, f"{name}.html")
    open(src, "w", encoding="utf-8").write(html)
    out = os.path.abspath(os.path.join(OUT, f"{name}.png"))
    extra = ["--default-background-color=00000000"] if name == "logo_1024" else []
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--window-size={w},{h}",
                    "--virtual-time-budget=6000", f"--screenshot={out}", *extra, "file:///" + src.replace("\\", "/")],
                   check=True, capture_output=True)
    print("ok", name, w, h)

os.makedirs(OUT, exist_ok=True)
for n in (sys.argv[1:] or DESIGNS):
    render(n)
