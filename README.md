# Booklet Reviews MVP

Minimal local Python script that reads a CSV exported from Google Forms / Google Sheets and generates a PDF booklet with all reviews.

## Current MVP behavior

- reads the CSV from `data/Alas de papel.csv`
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
├─ data/
│  └─ Alas de papel.csv
├─ output/
│  └─ reviews_booklet.pdf
├─ src/
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

## Output

The generated PDF will be saved to:

```text
output/reviews_booklet.pdf
```

## Notes

- This MVP uses `fpdf2` and core PDF fonts to keep setup simple.
- Unsupported characters such as emoji are removed from the PDF output.
- Later, the next natural improvement is adding a Unicode font so all characters are preserved.
