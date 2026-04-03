from __future__ import annotations

import re
import tempfile
from copy import deepcopy
from pathlib import Path

import streamlit as st

from src.build_pdf import build_pdf
from src.config import DEFAULT_CONFIG
from src.load_reviews import load_reviews


APP_TITLE = "Alas de papel"


FONT_PRESET_LABELS = {
    "bundled_dejavu": "DejaVu (incluida, recomendada)",
    "core_helvetica": "Helvetica básica",
    "custom": "Personalizada",
}

EMOJI_PRESET_LABELS = {
    "android_noto_color": "Android / Noto Color Emoji",
    "none": "Sin fuente emoji específica",
}


@st.cache_data(show_spinner=False)
def generate_pdf_bytes(csv_bytes: bytes, config: dict) -> tuple[bytes, int]:
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        csv_path = temp_path / "uploaded_reviews.csv"
        pdf_path = temp_path / "reviews_booklet.pdf"

        csv_path.write_bytes(csv_bytes)
        reviews = load_reviews(csv_path)
        build_pdf(reviews=reviews, output_path=pdf_path, config=config)
        return pdf_path.read_bytes(), len(reviews)


def main() -> None:
    st.set_page_config(page_title=APP_TITLE, page_icon="📚", layout="wide")

    st.title(APP_TITLE)
    st.write(
        "Sube un CSV exportado desde Google Forms / Google Sheets, ajusta las opciones y descarga el PDF."
    )

    base_config = deepcopy(DEFAULT_CONFIG)

    with st.sidebar:
        st.header("Opciones")

        booklet_title = st.text_input("Título del cuadernillo", value=base_config["booklet_title"])

        st.subheader("Portada")
        cover_enabled = st.toggle("Incluir portada", value=base_config["cover"]["enabled"])
        cover_title_text = st.text_input("Título de portada", value=base_config["cover"]["title_text"])
        cover_subtitle = st.text_input("Subtítulo", value=base_config["cover"]["subtitle"])
        show_review_count = st.toggle(
            "Mostrar número de revisiones", value=base_config["cover"]["show_review_count"]
        )
        review_count_format = st.text_input(
            "Formato del contador",
            value=base_config["cover"]["review_count_format"],
            help="Usa {count} para insertar el número de revisiones.",
        )

        st.subheader("Cabecera de cada revisión")
        show_review_counter = st.toggle(
            "Mostrar 'Revisión X de Y'", value=base_config["header"]["show_review_counter"]
        )
        show_reviewer_name = st.toggle(
            "Mostrar revisado por", value=base_config["header"]["show_reviewer_name"]
        )
        show_timestamp = st.toggle(
            "Mostrar fecha de revisión", value=base_config["header"]["show_timestamp"]
        )
        show_average_score = st.toggle(
            "Mostrar puntuación media", value=base_config["header"]["show_average_score"]
        )

        st.subheader("Contenido")
        start_each_review_on_new_page = st.toggle(
            "Empezar cada revisión en página nueva",
            value=base_config["pdf"]["start_each_review_on_new_page"],
        )
        show_empty_comments = st.toggle(
            "Mostrar bloques sin comentario",
            value=base_config["criteria"]["show_empty_comments"],
        )
        empty_comment_text = st.text_input(
            "Texto para comentario vacío", value=base_config["criteria"]["empty_comment_text"]
        )

        st.subheader("Fuentes")
        font_preset = st.selectbox(
            "Fuente principal",
            options=list(FONT_PRESET_LABELS.keys()),
            index=list(FONT_PRESET_LABELS.keys()).index(base_config["fonts"]["selection"]["preset"]),
            format_func=lambda key: FONT_PRESET_LABELS[key],
        )
        emoji_preset = st.selectbox(
            "Fuente emoji",
            options=list(EMOJI_PRESET_LABELS.keys()),
            index=list(EMOJI_PRESET_LABELS.keys()).index(base_config["fonts"]["selection"]["emoji_preset"]),
            format_func=lambda key: EMOJI_PRESET_LABELS[key],
        )
        emoji_enabled = st.toggle(
            "Activar emoji", value=base_config["fonts"]["selection"]["emoji_enabled"]
        )

    uploaded_file = st.file_uploader("CSV de respuestas", type=["csv"])

    col1, col2 = st.columns([2, 1])
    with col1:
        st.markdown(
            """**Qué hace esta app**  
1. Lee el CSV exportado desde el formulario.  
2. Ordena las respuestas por título del libro y fecha.  
3. Genera el PDF con la configuración elegida."""
        )
    with col2:
        st.info("No hace falta editar ningún archivo JSON.")

    if uploaded_file is None:
        st.warning("Sube un archivo CSV para generar el PDF.")
        return

    config = deepcopy(base_config)
    config["booklet_title"] = booklet_title
    config["cover"]["enabled"] = cover_enabled
    config["cover"]["title_text"] = cover_title_text
    config["cover"]["subtitle"] = cover_subtitle
    config["cover"]["show_review_count"] = show_review_count
    config["cover"]["review_count_format"] = review_count_format

    config["header"]["show_review_counter"] = show_review_counter
    config["header"]["show_reviewer_name"] = show_reviewer_name
    config["header"]["show_timestamp"] = show_timestamp
    config["header"]["show_average_score"] = show_average_score

    config["pdf"]["start_each_review_on_new_page"] = start_each_review_on_new_page
    config["criteria"]["show_empty_comments"] = show_empty_comments
    config["criteria"]["empty_comment_text"] = empty_comment_text

    config["fonts"]["selection"]["preset"] = font_preset
    config["fonts"]["selection"]["emoji_preset"] = emoji_preset
    config["fonts"]["selection"]["emoji_enabled"] = emoji_enabled

    if st.button("Generar PDF", type="primary"):
        csv_bytes = uploaded_file.getvalue()
        try:
            pdf_bytes, review_count = generate_pdf_bytes(csv_bytes, config)
        except Exception as exc:
            st.error(f"No se pudo generar el PDF: {exc}")
            return

        filename = make_filename(booklet_title)
        st.success(f"PDF generado correctamente. Revisiones procesadas: {review_count}")
        st.download_button(
            label="Descargar PDF",
            data=pdf_bytes,
            file_name=filename,
            mime="application/pdf",
        )



def make_filename(title: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", title.strip())
    cleaned = cleaned.strip("._") or "reviews_booklet"
    return f"{cleaned}.pdf"


if __name__ == "__main__":
    main()
