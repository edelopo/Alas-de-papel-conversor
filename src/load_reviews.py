from __future__ import annotations

import csv
from dataclasses import dataclass
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
    reviewer_name: str
    book_title: str
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

        review = Review(
            timestamp=_get_value(row, 0),
            reviewer_name=_get_value(row, 1),
            book_title=_get_value(row, 2),
            criteria=[
                CriterionReview(
                    name=criterion_name,
                    score=_get_value(row, score_index),
                    comment=_get_value(row, comment_index),
                )
                for criterion_name, score_index, comment_index in CRITERIA_COLUMN_PAIRS
            ],
        )
        reviews.append(review)

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
