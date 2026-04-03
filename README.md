# Booklet Reviews MVP

Minimal local Python script that reads a CSV exported from Google Forms / Google Sheets and generates a PDF booklet with all reviews.

## Current behavior

- reads the CSV path defined in `config.json`
- treats **one Google Form response as one review entry**
- sorts entries by **book title**, then by **submission timestamp**
- shows this header for each entry:
  - book title
  - reviewer name
  - timestamp
  - average numerical score across all criteria
- prints each criterion as a block:
  - criterion title
  - numerical score
  - written comment

## Project structure

```text
booklet_reviews_mvp/
├─ config.json
├─ data/
│  └─ Alas de papel.csv
├─ output/
│  └─ reviews_booklet.pdf
├─ src/
│  ├─ config.py
│  ├─ load_reviews.py
│  ├─ build_pdf.py
│  └─ main.py
├─ requirements.txt
└─ README.md
```

## Setup

Create and activate a virtual environment, then install dependencies:

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

## Run

```bash
python -m src.main
```

## Where to configure the PDF

Edit only `config.json`.

You can already change things like:

- input CSV path
- output PDF path
- booklet title
- cover page on/off
- whether to show review count on the cover
- whether each review starts on a new page
- whether empty comment blocks are shown
- margin sizes
- font sizes
- header labels such as `Reviewer`, `Submitted`, `Average score`, `Score`

## Output

The generated PDF will be saved to the path defined in:

```text
config.json -> output_pdf
```

## Notes

- This keeps the code simple: configuration is external, but the review-loading logic still matches your current Google Forms CSV structure.
- This MVP uses `fpdf2` with bundled Unicode fonts inside the project so it does not depend on font paths installed on your system.
- Unsupported characters such as emoji are removed from the PDF output.


Config notes:
- `cover.title_text`: custom cover title
- `cover.subtitle`: custom cover subtitle
- `cover.review_count_format`: custom review count text. Use `{count}` as the placeholder.


## Friendlier font selection

You can now choose a font preset in `config.json` instead of editing font paths directly.

```json
"fonts": {
  "selection": {
    "preset": "bundled_dejavu"
  }
}
```

Available presets:
- `bundled_dejavu`: uses the bundled project fonts and keeps good Unicode support
- `core_helvetica`: uses a built-in PDF font with no external font files
- `custom`: lets you provide your own font file paths in `fonts.custom`

If the selected font files are not found, the script falls back to the safe core font configured in `fonts.selection.fallback_core_family`.
