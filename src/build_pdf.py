from __future__ import annotations

from pathlib import Path
from typing import Iterable

from fpdf import FPDF

from .load_reviews import Review


class ReviewBookletPDF(FPDF):
    def header(self) -> None:
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "I", 9)
        self.cell(0, 8, _safe_text("Reading Group Reviews"), new_x="LMARGIN", new_y="NEXT", align="R")

    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("Helvetica", "I", 9)
        self.cell(0, 8, _safe_text(f"Page {self.page_no()}"), align="C")


def build_pdf(
    reviews: Iterable[Review],
    output_path: str | Path,
    booklet_title: str = "Reading Group Reviews",
) -> Path:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    pdf = ReviewBookletPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_margins(left=16, top=16, right=16)
    pdf.set_title(_safe_text(booklet_title))
    pdf.set_author("booklet_reviews_mvp")

    reviews = list(reviews)

    _add_cover_page(pdf, booklet_title, len(reviews))

    for index, review in enumerate(reviews, start=1):
        pdf.add_page()
        _add_review(pdf, review, index, len(reviews))

    pdf.output(str(output_path))
    return output_path


def _add_cover_page(pdf: FPDF, booklet_title: str, review_count: int) -> None:
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 22)
    pdf.ln(25)
    pdf.multi_cell(0, 12, _safe_text(booklet_title), align="C", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(10)
    pdf.set_font("Helvetica", "", 13)
    pdf.multi_cell(0, 8, _safe_text(f"Total reviews: {review_count}"), align="C", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(6)
    pdf.set_font("Helvetica", "I", 11)
    pdf.multi_cell(
        0,
        7,
        _safe_text("Sorted by book title and submission timestamp"),
        align="C",
        new_x="LMARGIN",
        new_y="NEXT",
    )


def _add_review(pdf: FPDF, review: Review, index: int, total: int) -> None:
    pdf.set_font("Helvetica", "B", 16)
    title = review.book_title or "Untitled book"
    pdf.multi_cell(0, 9, _safe_text(title), new_x="LMARGIN", new_y="NEXT")

    pdf.ln(1)
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(0, 7, _safe_text(f"Review {index} of {total}"), new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 7, _safe_text(f"Reviewer: {review.reviewer_name or 'Unknown'}"), new_x="LMARGIN", new_y="NEXT")
    if review.timestamp:
        pdf.cell(0, 7, _safe_text(f"Submitted: {review.timestamp}"), new_x="LMARGIN", new_y="NEXT")
    average_text = _format_average(review.average_score)
    pdf.cell(0, 7, _safe_text(f"Average score: {average_text}"), new_x="LMARGIN", new_y="NEXT")

    pdf.ln(4)

    for criterion in review.criteria:
        score_text = criterion.score if criterion.score else "-"
        pdf.set_font("Helvetica", "B", 12)
        pdf.multi_cell(0, 7, _safe_text(f"{criterion.name} - Score: {score_text}"), new_x="LMARGIN", new_y="NEXT")

        if criterion.comment:
            pdf.set_font("Helvetica", "", 11)
            pdf.multi_cell(0, 6, _safe_text(criterion.comment), new_x="LMARGIN", new_y="NEXT")
        else:
            pdf.set_font("Helvetica", "I", 11)
            pdf.multi_cell(0, 6, _safe_text("No comment provided."), new_x="LMARGIN", new_y="NEXT")

        pdf.ln(2)


def _format_average(value: float | None) -> str:
    if value is None:
        return "-"
    return f"{value:.1f}"


def _safe_text(text: str) -> str:
    """
    Convert text to something that works with FPDF core fonts.

    MVP choice:
    - keep the project dependency-light
    - avoid requiring the user to install external font files
    - replace a few common unicode punctuation characters
    - drop unsupported characters such as emoji
    """
    replacements = {
        "\u2014": "-",   # em dash
        "\u2013": "-",   # en dash
        "\u2026": "...", # ellipsis
        "\u00a0": " ",   # non-breaking space
        "\u202f": " ",   # narrow no-break space
        "\u2009": " ",   # thin space
        "\u200b": "",    # zero-width space
        "\ufeff": "",    # bom
        "’": "'",
        "‘": "'",
        "“": '"',
        "”": '"',
    }

    cleaned = text
    for old, new in replacements.items():
        cleaned = cleaned.replace(old, new)

    return cleaned.encode("latin-1", errors="ignore").decode("latin-1")
