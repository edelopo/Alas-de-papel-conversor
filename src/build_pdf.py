from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable

from fpdf import FPDF

from .load_reviews import Review


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SYSTEM_FONT_CANDIDATES = {
    "text_regular": [Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")],
    "text_bold": [Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")],
    "text_italic": [Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf")],
    "emoji": [Path("/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf")],
    "symbols": [Path("/usr/share/fonts/truetype/noto/NotoSansSymbols2-Regular.ttf")],
}


class ReviewBookletPDF(FPDF):
    def __init__(self, config: dict[str, Any]) -> None:
        pdf_config = config["pdf"]
        super().__init__(orientation=pdf_config["orientation"], format=pdf_config["page_size"])
        self.config = config
        self.base_font_family = "Helvetica"
        self.emoji_font_family: str | None = None
        self._register_fonts()

    def _register_fonts(self) -> None:
        fonts_config = self.config.get("fonts", {})
        text_config = fonts_config.get("text", {})
        emoji_config = fonts_config.get("emoji", {})

        fallback_core = text_config.get("fallback_core_family", "Helvetica")
        self.base_font_family = fallback_core

        regular = _resolve_font_path(text_config.get("regular"), SYSTEM_FONT_CANDIDATES["text_regular"])
        bold = _resolve_font_path(text_config.get("bold"), SYSTEM_FONT_CANDIDATES["text_bold"])
        italic = _resolve_font_path(text_config.get("italic"), SYSTEM_FONT_CANDIDATES["text_italic"])
        configured_family_name = text_config.get("family_name", "CustomText")

        if regular and bold and italic:
            self.add_font(configured_family_name, style="", fname=str(regular))
            self.add_font(configured_family_name, style="B", fname=str(bold))
            self.add_font(configured_family_name, style="I", fname=str(italic))
            self.base_font_family = configured_family_name

        fallback_fonts: list[str] = []
        if emoji_config.get("enabled", True):
            emoji_path = _resolve_font_path(emoji_config.get("regular"), SYSTEM_FONT_CANDIDATES["emoji"])
            emoji_family_name = emoji_config.get("family_name", "Emoji")
            if emoji_path:
                self.add_font(emoji_family_name, style="", fname=str(emoji_path))
                self.emoji_font_family = emoji_family_name
                fallback_fonts.append(emoji_family_name)

            symbol_path = _resolve_font_path(emoji_config.get("fallback_symbols"), SYSTEM_FONT_CANDIDATES["symbols"])
            if symbol_path:
                symbol_family_name = "SymbolFallback"
                self.add_font(symbol_family_name, style="", fname=str(symbol_path))
                fallback_fonts.append(symbol_family_name)

        if fallback_fonts:
            self.set_fallback_fonts(fallback_fonts, exact_match=False)

    def header(self) -> None:
        if self.page_no() == 1:
            return
        font_size = self.config["fonts"]["header_footer_size"]
        self.set_font(self.base_font_family, "I", font_size)
        self.cell(0, 8, _safe_text(self.config["booklet_title"]), new_x="LMARGIN", new_y="NEXT", align="R")

    def footer(self) -> None:
        font_size = self.config["fonts"]["header_footer_size"]
        self.set_y(-12)
        self.set_font(self.base_font_family, "I", font_size)
        self.cell(0, 8, _safe_text(str(self.page_no())), align="C")


def _resolve_font_path(configured_path: str | None, system_candidates: list[Path]) -> Path | None:
    if configured_path:
        candidate = Path(configured_path)
        if not candidate.is_absolute():
            candidate = PROJECT_ROOT / candidate
        if candidate.exists():
            return candidate
    for candidate in system_candidates:
        if candidate.exists():
            return candidate
    return None


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

    pdf.set_font(pdf.base_font_family, "B", fonts["cover_title_size"])
    pdf.ln(25)
    pdf.multi_cell(0, 12, _safe_text(title_text), align="C", new_x="LMARGIN", new_y="NEXT")

    if subtitle:
        pdf.ln(spacing["after_cover_title"])
        pdf.set_font(pdf.base_font_family, "I", fonts["cover_subtitle_size"])
        pdf.multi_cell(0, 7, _safe_text(subtitle), align="C", new_x="LMARGIN", new_y="NEXT")

    if review_count_text:
        pdf.ln(spacing["after_cover_meta"])
        pdf.set_font(pdf.base_font_family, "", fonts["cover_meta_size"])
        pdf.multi_cell(0, 8, _safe_text(review_count_text), align="C", new_x="LMARGIN", new_y="NEXT")


def _add_review(pdf: FPDF, review: Review, index: int, total: int, config: dict[str, Any]) -> None:
    fonts = config["fonts"]
    spacing = config["spacing"]
    header = config["header"]
    criteria_config = config["criteria"]
    labels = header["labels"]

    pdf.set_font(pdf.base_font_family, "B", fonts["review_title_size"])
    title = review.book_title or "Untitled book"
    pdf.multi_cell(0, 9, _safe_text(title), new_x="LMARGIN", new_y="NEXT")

    pdf.ln(spacing["before_review_meta"])
    pdf.set_font(pdf.base_font_family, "", fonts["meta_size"])

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
            pdf.set_font(pdf.base_font_family, "", fonts["body_size"])
            pdf.multi_cell(0, 6, _safe_text(criterion.comment), new_x="LMARGIN", new_y="NEXT")
        else:
            pdf.set_font(pdf.base_font_family, "I", fonts["body_size"])
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
    right_text = _format_score_display(score_value, criteria_config)

    left_x = pdf.l_margin
    right_limit = pdf.w - pdf.r_margin
    current_y = pdf.get_y()
    gap = 6

    pdf.set_font(pdf.base_font_family, "B", fonts["criterion_title_size"])

    right_width = pdf.get_string_width(_safe_text(right_text)) + 2
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
    numeric_score = _parse_numeric_score(clean_value)

    if style == "numeric":
        label = criteria_config.get("score_label", "Score")
        return f"{label}: {clean_value}"

    if numeric_score is None:
        return clean_value

    stars_text = _score_to_stars(numeric_score, criteria_config)
    numeric_text = _format_numeric_score(numeric_score)

    if style == "stars":
        return stars_text
    if style == "numeric_and_stars":
        return f"{stars_text} {numeric_text}"

    label = criteria_config.get("score_label", "Score")
    return f"{label}: {clean_value}"


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


def _format_numeric_score(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    return f"{value:.1f}"


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
        "\xa0": " ",
        "\u202f": " ",
        "\u2009": " ",
        "\u200b": "",
        "\ufeff": "",
        "’": "'",
        "‘": "'",
        "“": '"',
        "”": '"',
    }

    cleaned = text
    for old, new in replacements.items():
        cleaned = cleaned.replace(old, new)

    return cleaned
