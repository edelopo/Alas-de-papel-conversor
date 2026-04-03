from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any


DEFAULT_CONFIG: dict[str, Any] = {
    "input_csv": "data/Alas de papel.csv",
    "output_pdf": "output/reviews_booklet.pdf",
    "booklet_title": "Reading Group Reviews",
    "pdf": {
        "page_size": "A4",
        "orientation": "P",
        "margins": {"left": 16, "top": 16, "right": 16, "bottom": 15},
        "auto_page_break": True,
        "start_each_review_on_new_page": True,
    },
    "cover": {
        "enabled": True,
        "show_review_count": True,
        "subtitle": "Sorted by book title and submission timestamp",
    },
    "header": {
        "show_review_counter": True,
        "show_reviewer_name": True,
        "show_timestamp": True,
        "show_average_score": True,
        "labels": {
            "review_counter": "Review",
            "reviewer_name": "Reviewer",
            "timestamp": "Submitted",
            "average_score": "Average score",
        },
    },
    "criteria": {
        "show_empty_comments": True,
        "empty_comment_text": "No comment provided.",
        "score_label": "Score",
    },
    "fonts": {
        "selection": {
            "preset": "bundled_dejavu",
            "allow_system_font_search": True,
            "emoji_enabled": True,
            "fallback_core_family": "Helvetica",
        },
        "presets": {
            "bundled_dejavu": {
                "text_family_name": "DejaVu",
                "regular": "fonts/DejaVuSans.ttf",
                "bold": "fonts/DejaVuSans-Bold.ttf",
                "italic": "fonts/DejaVuSans-Oblique.ttf",
                "symbol_fallback": "fonts/NotoSansSymbols2-Regular.ttf",
            },
            "core_helvetica": {
                "use_core_font": "Helvetica",
            },
        },
        "custom": {
            "text_family_name": "CustomFont",
            "regular": "",
            "bold": "",
            "italic": "",
            "symbol_fallback": "",
        },
        "cover_title_size": 22,
        "cover_meta_size": 13,
        "cover_subtitle_size": 11,
        "review_title_size": 16,
        "meta_size": 11,
        "criterion_title_size": 12,
        "body_size": 11,
        "header_footer_size": 9,
    },
    "spacing": {
        "after_cover_title": 10,
        "after_cover_meta": 6,
        "before_review_meta": 1,
        "before_criteria": 4,
        "between_criteria": 2,
    },
}


def load_config(config_path: str | Path) -> dict[str, Any]:
    config_path = Path(config_path)
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with config_path.open("r", encoding="utf-8") as file:
        user_config = json.load(file)

    merged = deepcopy(DEFAULT_CONFIG)
    _deep_update(merged, user_config)
    return merged


def _deep_update(base: dict[str, Any], updates: dict[str, Any]) -> None:
    for key, value in updates.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            _deep_update(base[key], value)
        else:
            base[key] = value
