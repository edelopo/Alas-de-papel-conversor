from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable

from fpdf import FPDF

from .load_reviews import Review


class ReviewBookletPDF(FPDF):
    def __init__(self, config: dict[str, Any]) -> None:
        pdf_config = config["pdf"]
        super().__init__(orientation=pdf_config["orientation"], format=pdf_config["page_size"])
        self.config = config

    def header(self) -> None:
        if self.page_no() == 1:
            return
        font_size = self.config["fonts"]["header_footer_size"]
        self.set_font("Helvetica", "I", font_size)
        self.cell(0, 8, _safe_text(self.config["booklet_title"]), new_x="LMARGIN", new_y="NEXT", align="R")

    def footer(self) -> None:
        font_size = self.config["fonts"]["header_footer_size"]
        self.set_y(-12)
        self.set_font("Helvetica", "I", font_size)
        self.cell(0, 8, _safe_text(f"Page {self.page_no()}"), align="C")


def build_pdf(
    reviews: Iterable[Review],
    output_path: str | Path,
    config: dict[str, Any],
) -> Path:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    pdf = ReviewBookletPDF(config)
    margins = config["pdf"]["margins"]
    pdf.set_auto_page_break(auto=config["pdf"]["auto_page_break"], margin=margins["bottom"])
    pdf.set_margins(left=margins["left"], top=margins["top"], right=margins["right"])
    pdf.set_title(_safe_text(config["booklet_title"]))
    pdf.set_author("booklet_reviews_mvp")

    reviews = list(reviews)

    if config["cover"]["enabled"]:
        _add_cover_page(pdf, config, len(reviews))

    for index, review in enumerate(reviews, start=1):
        if config["pdf"]["start_each_review_on_new_page"] or pdf.page_no() == 0:
            pdf.add_page()
        _add_review(pdf, review, index, len(reviews), config)

    pdf.output(str(output_path))
    return output_path


def _add_cover_page(pdf: FPDF, config: dict[str, Any], review_count: int) -> None:
    spacing = config["spacing"]
    fonts = config["fonts"]
    cover = config["cover"]

    pdf.add_page()
    pdf.set_font("Helvetica", "B", fonts["cover_title_size"])
    pdf.ln(25)
    pdf.multi_cell(0, 12, _safe_text(config["booklet_title"]), align="C", new_x="LMARGIN", new_y="NEXT")

    if cover["show_review_count"]:
        pdf.ln(spacing["after_cover_title"])
        pdf.set_font("Helvetica", "", fonts["cover_meta_size"])
        pdf.multi_cell(0, 8, _safe_text(f"Total reviews: {review_count}"), align="C", new_x="LMARGIN", new_y="NEXT")

    subtitle = cover.get("subtitle", "")
    if subtitle:
        pdf.ln(spacing["after_cover_meta"])
        pdf.set_font("Helvetica", "I", fonts["cover_subtitle_size"])
        pdf.multi_cell(0, 7, _safe_text(subtitle), align="C", new_x="LMARGIN", new_y="NEXT")


def _add_review(pdf: FPDF, review: Review, index: int, total: int, config: dict[str, Any]) -> None:
    fonts = config["fonts"]
    spacing = config["spacing"]
    header = config["header"]
    criteria_config = config["criteria"]
    labels = header["labels"]

    pdf.set_font("Helvetica", "B", fonts["review_title_size"])
    title = review.book_title or "Untitled book"
    pdf.multi_cell(0, 9, _safe_text(title), new_x="LMARGIN", new_y="NEXT")

    pdf.ln(spacing["before_review_meta"])
    pdf.set_font("Helvetica", "", fonts["meta_size"])

    if header["show_review_counter"]:
        pdf.cell(0, 7, _safe_text(f"{labels['review_counter']} {index} of {total}"), new_x="LMARGIN", new_y="NEXT")
    if header["show_reviewer_name"]:
        reviewer = review.reviewer_name or "Unknown"
        pdf.cell(0, 7, _safe_text(f"{labels['reviewer_name']}: {reviewer}"), new_x="LMARGIN", new_y="NEXT")
    if header["show_timestamp"] and review.timestamp:
        pdf.cell(0, 7, _safe_text(f"{labels['timestamp']}: {review.timestamp}"), new_x="LMARGIN", new_y="NEXT")
    if header["show_average_score"]:
        average_text = _format_average(review.average_score)
        pdf.cell(0, 7, _safe_text(f"{labels['average_score']}: {average_text}"), new_x="LMARGIN", new_y="NEXT")

    pdf.ln(spacing["before_criteria"])

    for criterion in review.criteria:
        has_comment = bool(criterion.comment)
        if not has_comment and not criteria_config["show_empty_comments"]:
            continue

        score_text = criterion.score if criterion.score else "-"
        pdf.set_font("Helvetica", "B", fonts["criterion_title_size"])
        pdf.multi_cell(
            0,
            7,
            _safe_text(f"{criterion.name} - {criteria_config['score_label']}: {score_text}"),
            new_x="LMARGIN",
            new_y="NEXT",
        )

        if has_comment:
            pdf.set_font("Helvetica", "", fonts["body_size"])
            pdf.multi_cell(0, 6, _safe_text(criterion.comment), new_x="LMARGIN", new_y="NEXT")
        else:
            pdf.set_font("Helvetica", "I", fonts["body_size"])
            pdf.multi_cell(0, 6, _safe_text(criteria_config["empty_comment_text"]), new_x="LMARGIN", new_y="NEXT")

        pdf.ln(spacing["between_criteria"])


def _format_average(value: float | None) -> str:
    if value is None:
        return "-"
    return f"{value:.1f}"


def _safe_text(text: str) -> str:
    replacements = {
        "—": "-",
        "–": "-",
        "…": "...",
        " ": " ",
        " ": " ",
        " ": " ",
        "​": "",
        "﻿": "",
        "’": "'",
        "‘": "'",
        "“": '"',
        "”": '"',
    }

    cleaned = text
    for old, new in replacements.items():
        cleaned = cleaned.replace(old, new)

    return cleaned.encode("latin-1", errors="ignore").decode("latin-1")
