from __future__ import annotations

from pathlib import Path

from .build_pdf import build_pdf
from .config import load_config
from .load_reviews import load_reviews


def main() -> None:
    project_root = Path(__file__).resolve().parents[1]
    config_path = project_root / "config.json"
    config = load_config(config_path)

    input_csv = project_root / config["input_csv"]
    output_pdf = project_root / config["output_pdf"]

    reviews = load_reviews(input_csv)
    build_pdf(
        reviews=reviews,
        output_path=output_pdf,
        config=config,
    )

    print(f"Loaded {len(reviews)} reviews.")
    print(f"Config used: {config_path}")
    print(f"PDF created at: {output_pdf}")


if __name__ == "__main__":
    main()
