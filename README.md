# Review Booklet MVP

Small Python project to turn Google Forms / Google Sheets review responses exported as CSV into a PDF booklet.

## What this MVP does

- reads one CSV file exported from Google Sheets
- supports the current column structure in your file
- generates one PDF booklet with all reviews in order
- includes:
  - reviewer name
  - book title
  - timestamp
  - one section per review criterion with score + comment

## Project structure

- `data/Alas de papel.csv`: input CSV
- `src/load_reviews.py`: CSV loading and normalization
- `src/build_pdf.py`: PDF generation
- `src/main.py`: entry point

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

From the project root:

```bash
python -m src.main
```

That will read:

- `data/Alas de papel.csv`

and create:

- `output/reviews_booklet.pdf`

## Notes

- This MVP expects the same column format as your current Google Forms export.
- The reviews are kept in CSV order.
- If later you want a cleaner visual design, we can add:
  - cover page
  - page numbers
  - custom fonts
  - colors
  - section grouping
  - configurable layout
