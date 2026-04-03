from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable

from fpdf import FPDF

from .load_reviews import Review


DEJAVU_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
DEJAVU_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
DEJAVU_ITALIC = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf"
NOTO_SYMBOLS = "/usr/share/fonts/truetype/noto/NotoSansSymbols2-Regular.ttf"


class ReviewBookletPDF(FPDF):
    def __init__(self, config: dict[str, Any]) -> None:
        pdf_config = config["pdf"]
        super().__init__(orientation=pdf_config["orientation"], format=pdf_config["page_size"])
        self.config = config
        self._fonts_ready = False
        self._register_fonts()

    def _register_fonts(self) -> None:
        if self._fonts_ready:
            return
        self.add_font("DejaVu", style="", fname=DEJAVU_REGULAR)
        self.add_font("DejaVu", style="B", fname=DEJAVU_BOLD)
        self.add_font("DejaVu", style="I", fname=DEJAVU_ITALIC)
        self.add_font("NotoSymbols", style="", fname=NOTO_SYMBOLS)
        self.set_fallback_fonts(["NotoSymbols"], exact_match=False)
        self._fonts_ready = True

    def header(self) -> None:
        if self.page_no() == 1:
            return
        font_size = self.config["fonts"]["header_footer_size"]
        self.set_font("DejaVu", "I", font_size)
        self.cell(0, 8, _safe_text(self.config["booklet_title"]), new_x="LMARGIN", new_y="NEXT", align="R")

    def footer(self) -> None:
        font_size = self.config["fonts"]["header_footer_size"]
        self.set_y(-12)
        self.set_font("DejaVu", "I", font_size)
        self.cell(0, 8, _safe_text(str(self.page_no())), align="C")


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

    title_text = cover.get("title_text") or config["booklet_title"]
    subtitle = cover.get("subtitle", "")
    review_count_text = ""
    if cover.get("show_review_count", False):
        review_count_format = cover.get("review_count_format", "Total reviews: {count}")
        review_count_text = review_count_format.format(count=review_count)

    pdf.set_font("DejaVu", "B", fonts["cover_title_size"])
    pdf.ln(25)
    pdf.multi_cell(0, 12, _safe_text(title_text), align="C", new_x="LMARGIN", new_y="NEXT")

    if subtitle:
        pdf.ln(spacing["after_cover_title"])
        pdf.set_font("DejaVu", "I", fonts["cover_subtitle_size"])
        pdf.multi_cell(0, 7, _safe_text(subtitle), align="C", new_x="LMARGIN", new_y="NEXT")

    if review_count_text:
        pdf.ln(spacing["after_cover_meta"])
        pdf.set_font("DejaVu", "", fonts["cover_meta_size"])
        pdf.multi_cell(0, 8, _safe_text(review_count_text), align="C", new_x="LMARGIN", new_y="NEXT")


def _add_review(pdf: FPDF, review: Review, index: int, total: int, config: dict[str, Any]) -> None:
    fonts = config["fonts"]
    spacing = config["spacing"]
    header = config["header"]
    criteria_config = config["criteria"]
    labels = header["labels"]

    pdf.set_font("DejaVu", "B", fonts["review_title_size"])
    title = review.book_title or "Untitled book"
    pdf.multi_cell(0, 9, _safe_text(title), new_x="LMARGIN", new_y="NEXT")

    pdf.ln(spacing["before_review_meta"])
    pdf.set_font("DejaVu", "", fonts["meta_size"])

    _add_reviewer_and_counter_line(pdf, review, index, total, header, labels)
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

        _add_criterion_header(pdf, criterion.name, criterion.score, config)

        if has_comment:
            pdf.set_font("DejaVu", "", fonts["body_size"])
            pdf.multi_cell(0, 6, _safe_text(criterion.comment), new_x="LMARGIN", new_y="NEXT")
        else:
            pdf.set_font("DejaVu", "I", fonts["body_size"])
            pdf.multi_cell(0, 6, _safe_text(criteria_config["empty_comment_text"]), new_x="LMARGIN", new_y="NEXT")

        pdf.ln(spacing["between_criteria"])


def _add_reviewer_and_counter_line(
    pdf: FPDF,
    review: Review,
    index: int,
    total: int,
    header: dict[str, Any],
    labels: dict[str, str],
) -> None:
    reviewer_text = ""
    if header["show_reviewer_name"]:
        reviewer = review.reviewer_name or "Unknown"
        reviewer_text = f"{labels['reviewer_name']}: {reviewer}"

    counter_text = ""
    if header["show_review_counter"]:
        counter_text = f"{labels['review_counter']} {index} of {total}"

    if reviewer_text and counter_text:
        left_x = pdf.l_margin
        right_limit = pdf.w - pdf.r_margin
        current_y = pdf.get_y()
        gap = 6

        pdf.set_xy(left_x, current_y)
        pdf.cell(0, 7, _safe_text(reviewer_text), new_x="LMARGIN", new_y="NEXT")

        counter_width = pdf.get_string_width(_safe_text(counter_text)) + 1
        available_width = max(20, right_limit - left_x - gap)
        reviewer_width = max(20, available_width - counter_width)

        pdf.set_xy(left_x, current_y)
        pdf.cell(reviewer_width, 7, _safe_text(reviewer_text), border=0, align="L")
        pdf.cell(0, 7, _safe_text(counter_text), border=0, align="R", new_x="LMARGIN", new_y="NEXT")
        return

    if reviewer_text:
        pdf.cell(0, 7, _safe_text(reviewer_text), new_x="LMARGIN", new_y="NEXT")
    elif counter_text:
        pdf.cell(0, 7, _safe_text(counter_text), new_x="LMARGIN", new_y="NEXT", align="R")


def _add_criterion_header(pdf: FPDF, criterion_name: str, score_value: str, config: dict[str, Any]) -> None:
    fonts = config["fonts"]
    criteria_config = config["criteria"]
    label = criteria_config.get("score_label", "Score")
    score_text = _format_score_display(score_value, criteria_config)
    right_text = f"{label}: {score_text}"

    left_x = pdf.l_margin
    right_limit = pdf.w - pdf.r_margin
    current_y = pdf.get_y()
    gap = 6

    pdf.set_font("DejaVu", "B", fonts["criterion_title_size"])

    right_width = pdf.get_string_width(_safe_text(right_text)) + 1
    available_width = max(30, right_limit - left_x - gap)
    left_width = max(30, available_width - right_width)

    pdf.set_xy(left_x, current_y)
    pdf.multi_cell(left_width, 7, _safe_text(criterion_name), border=0, align="L")
    end_y = pdf.get_y()
    used_lines = max(1, round((end_y - current_y) / 7))
    line_height = 7
    total_height = used_lines * line_height

    pdf.set_xy(left_x + left_width + gap, current_y)
    pdf.cell(max(10, right_limit - (left_x + left_width + gap)), total_height, _safe_text(right_text), align="R")
    pdf.set_y(current_y + total_height)


def _format_score_display(value: str, criteria_config: dict[str, Any]) -> str:
    clean_value = value.strip()
    if not clean_value:
        return "-"

    style = criteria_config.get("score_style", "numeric")
    if style != "stars":
        return clean_value

    numeric_score = _parse_numeric_score(clean_value)
    if numeric_score is None:
        return clean_value

    return _score_to_stars(numeric_score, criteria_config)


def _score_to_stars(score: float, criteria_config: dict[str, Any]) -> str:
    symbols = criteria_config.get("star_symbols", {})
    full = symbols.get("full", "★")
    half = symbols.get("half", "⯨")
    empty = symbols.get("empty", "☆")
    scale_max = criteria_config.get("star_scale_max", 10)

    normalized = max(0, min(scale_max, int(round(score))))
    full_count = normalized // 2
    half_count = normalized % 2
    empty_count = 5 - full_count - half_count
    return (full * full_count) + (half * half_count) + (empty * empty_count)


def _parse_numeric_score(value: str) -> float | None:
    cleaned = value.strip().replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


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

    return cleaned
