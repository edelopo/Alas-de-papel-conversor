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
.venv\Scriptsctivate

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
- This MVP still uses `fpdf2` and core PDF fonts to keep setup simple.
- Unsupported characters such as emoji are removed from the PDF output.
