# Booklet reviews MVP

Small Python project for a reading group.

It takes review data exported from Google Forms / Google Sheets as CSV and generates a PDF booklet with all reviews in order.

## Two ways to use it

### 1. Simple app for non-technical users

This is the recommended option.

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
streamlit run app.py
```

Then:
- upload the CSV
- choose the options from the sidebar
- click **Generar PDF**
- download the PDF

Streamlit runs a local web app in your browser. Streamlit's basic workflow is to run a Python script with `streamlit run ...`, open a local server, and use widgets such as file uploaders and download buttons to interact with the app.

### 2. Script mode

Still available for manual/local use:

```bash
python -m src.main
```

This reads:
- `config.json`
- `data/Alas de papel.csv`

And writes:
- `output/reviews_booklet.pdf`

## Notes

- The app expects a CSV exported from Google Forms / Google Sheets with the same structure as the sample file.
- The PDF keeps the current logic: one entry per response, ordered by book title and timestamp.
- The app uses Streamlit widgets for text input, toggles, select boxes, file upload and file download.