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

Streamlit runs a local web app in your browser. Streamlit's basic workflow is to run a Python script with `streamlit run ...`, open a local server, and use widgets such as file uploaders and download buttons to interact with the app. citeturn0search10turn0search2turn0search0

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
- The app uses Streamlit widgets for text input, toggles, select boxes, file upload and file download. citeturn0search1turn0search3turn0search2turn0search0turn0search6

### 3. GitHub Pages app

The repository also includes a static browser app in `index.html`. It parses the CSV and creates the PDF in the browser, so review data is not uploaded to a server.

To publish it from GitHub:

1. Open **Settings > Pages** in the repository.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select the `main` branch and the `/ (root)` folder.
4. Open the generated Pages URL.

The web app uses the bundled fonts from `fonts/` and loads `jsPDF` from a public CDN. The Python/Streamlit app remains available locally while the browser-generated PDF is compared with the current output.
