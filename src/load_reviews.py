from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List


@dataclass
class CriterionReview:
    name: str
    score: str
    comment: str


@dataclass
class Review:
    timestamp: str
    timestamp_sort_key: datetime
    reviewer_name: str
    book_title: str
    average_score: float | None
    criteria: List[CriterionReview]


EXPECTED_BASE_COLUMNS = [
    "Marca temporal",
    "¿Quién eres?",
    "Título del libro",
]

# The Google Forms CSV alternates:
# score column, blank comment column, score column, blank comment column...
CRITERIA_COLUMN_PAIRS = [
    ("PREDICTIBILIDAD", 3, 4),
    ("CARISMA PERSONAJES", 5, 6),
    ("PUNTOS DE VISTA", 7, 8),
    ("AMBIENTACIÓN (Espacio, entorno, época…)", 9, 10),
    ("EXPRESIÓN ESCRITA", 11, 12),
    ("EMOCIÓMETRO", 13, 14),
    ("DIÁLOGOS", 15, 16),
    ("ESTÉTICA DEL LIBRO", 17, 18),
    ("ENGANCHE", 19, 20),
    ("FINAL", 21, 22),
]


TIMESTAMP_PATTERN = re.compile(
    r"^(?P<date>\d{4}/\d{2}/\d{2})\s+"
    r"(?P<time>\d{1,2}:\d{2}:\d{2})\s+"
    r"(?P<meridiem>[ap])\.\s*m\."
)


def load_reviews(csv_path: str | Path) -> List[Review]:
    csv_path = Path(csv_path)

    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    with csv_path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.reader(file)
        rows = list(reader)

    if not rows:
        return []

    headers = rows[0]
    _validate_headers(headers)

    reviews: List[Review] = []
    for row in rows[1:]:
        if _is_empty_row(row):
            continue

        row = _pad_row(row, len(headers))
        criteria = [
            CriterionReview(
                name=criterion_name,
                score=_get_value(row, score_index),
                comment=_get_value(row, comment_index),
            )
            for criterion_name, score_index, comment_index in CRITERIA_COLUMN_PAIRS
        ]
        raw_timestamp = _get_value(row, 0)
        parsed_timestamp = _parse_timestamp(raw_timestamp)
        review = Review(
            timestamp=_format_timestamp_for_display(raw_timestamp, parsed_timestamp),
            timestamp_sort_key=parsed_timestamp,
            reviewer_name=_get_value(row, 1),
            book_title=_get_value(row, 2),
            average_score=_compute_average_score(criteria),
            criteria=criteria,
        )
        reviews.append(review)

    reviews.sort(key=lambda review: (_sort_text(review.book_title), review.timestamp_sort_key))
    return reviews


def _validate_headers(headers: list[str]) -> None:
    missing_base = [
        column for column, index in zip(EXPECTED_BASE_COLUMNS, [0, 1, 2]) if _clean_value(headers[index]) != column
    ]
    if missing_base:
        joined = ", ".join(missing_base)
        raise ValueError(
            "The CSV does not match the expected structure. "
            f"Missing base columns: {joined}"
        )

    for criterion_name, score_index, _comment_index in CRITERIA_COLUMN_PAIRS:
        if score_index >= len(headers) or _clean_value(headers[score_index]) != criterion_name:
            raise ValueError(
                "The CSV does not match the expected structure. "
                f"Expected score column '{criterion_name}' at index {score_index}."
            )


def _compute_average_score(criteria: list[CriterionReview]) -> float | None:
    numeric_scores: list[float] = []
    for criterion in criteria:
        score = _parse_score(criterion.score)
        if score is not None:
            numeric_scores.append(score)

    if not numeric_scores:
        return None

    return sum(numeric_scores) / len(numeric_scores)


def _parse_score(value: str) -> float | None:
    value = _clean_value(value).replace(",", ".")
    if not value:
        return None

    try:
        return float(value)
    except ValueError:
        return None


def _format_timestamp_for_display(raw_value: str, parsed_value: datetime) -> str:
    if parsed_value == datetime.max:
        return raw_value
    return parsed_value.strftime("%Y/%m/%d %H:%M:%S")


def _parse_timestamp(value: str) -> datetime:
    cleaned = _clean_value(value)
    if not cleaned:
        return datetime.max

    normalized = (
        cleaned.replace("\u202f", " ")
        .replace("\xa0", " ")
        .replace("a. m.", "AM")
        .replace("p. m.", "PM")
        .replace("a.m.", "AM")
        .replace("p.m.", "PM")
    )

    match = TIMESTAMP_PATTERN.match(cleaned.replace("\u202f", " ").replace("\xa0", " "))
    if match:
        meridiem = "AM" if match.group("meridiem") == "a" else "PM"
        simple_value = f"{match.group('date')} {match.group('time')} {meridiem}"
        return datetime.strptime(simple_value, "%Y/%m/%d %I:%M:%S %p")

    for fmt in ("%Y/%m/%d %I:%M:%S %p %Z", "%Y/%m/%d %H:%M:%S"):
        try:
            return datetime.strptime(normalized, fmt)
        except ValueError:
            continue

    return datetime.max


def _sort_text(value: str) -> str:
    return _clean_value(value).casefold()


def _get_value(row: list[str], index: int) -> str:
    if index >= len(row):
        return ""
    return _clean_value(row[index])


def _pad_row(row: list[str], target_length: int) -> list[str]:
    if len(row) >= target_length:
        return row
    return row + [""] * (target_length - len(row))


def _clean_value(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _is_empty_row(row: list[str]) -> bool:
    return not any(_clean_value(value) for value in row)
