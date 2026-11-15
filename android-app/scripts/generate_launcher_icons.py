"""Generate Android launcher icons from frontend/public/mani-logo.png."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "frontend" / "public" / "mani-logo.png"
RES = ROOT / "android-app" / "app" / "src" / "main" / "res"

LEGACY = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

NAVY = (11, 31, 58, 255)  # #0B1F3A


def fit_square(img: Image.Image, size: int, pad_ratio: float = 0.0) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), NAVY)
    inner = max(1, int(size * (1.0 - pad_ratio)))
    scaled = img.copy()
    scaled.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    x = (size - scaled.width) // 2
    y = (size - scaled.height) // 2
    canvas.paste(scaled, (x, y), scaled)
    return canvas


def main() -> None:
    src = Image.open(SRC).convert("RGBA")

    for folder, size in LEGACY.items():
        out_dir = RES / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        icon = fit_square(src, size, pad_ratio=0.0)
        icon.save(out_dir / "ic_launcher.png", optimize=True)
        icon.save(out_dir / "ic_launcher_round.png", optimize=True)
        print(f"wrote {folder} {size}x{size}")

    # Adaptive foreground: 108dp @ xxxhdpi = 432px; slight inset for OEM masks
    fg_size = 432
    drawable = RES / "drawable"
    drawable.mkdir(parents=True, exist_ok=True)
    fg = fit_square(src, fg_size, pad_ratio=0.08)
    fg_path = drawable / "ic_launcher_foreground.png"
    fg.save(fg_path, optimize=True)
    print(f"wrote {fg_path.name} {fg_size}x{fg_size}")

    vec = drawable / "ic_launcher_foreground.xml"
    if vec.exists():
        vec.unlink()
        print("removed vector ic_launcher_foreground.xml")

    print("done")


if __name__ == "__main__":
    main()
