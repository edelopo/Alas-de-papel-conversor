# booklet_reviews_mvp

Minimal local script that reads a CSV exported from Google Forms / Google Sheets and generates a PDF booklet of reviews.

## Run

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
python -m src.main
```

## Files you edit

- `data/Alas de papel.csv`
- `config.json`

## Friendly font setup

The default setup already uses bundled fonts.

### Recommended default

```json
"fonts": {
  "selection": {
    "preset": "bundled_dejavu",
    "emoji_preset": "android_noto_color",
    "allow_system_font_search": true,
    "emoji_enabled": true,
    "fallback_core_family": "Helvetica"
  }
}
```

- `bundled_dejavu` uses the text fonts inside `fonts/`
- `android_noto_color` uses `NotoColorEmoji.ttf`, which matches the Google / Android emoji style
- if the configured text font is not found, the script falls back to `Helvetica`
- if the emoji font is missing, the PDF still generates, but some emoji may not render

### Other text preset

```json
"preset": "core_helvetica"
```

### Custom fonts later

Use:

```json
"preset": "custom"
```

and then fill `fonts.custom` with your own paths.
