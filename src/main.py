from __future__ import annotations

from pathlib import Path

from .build_pdf import build_pdf
from .load_reviews import load_reviews


def main() -> None:
    project_root = Path(__file__).resolve().parents[1]
    input_csv = project_root / "data" / "Alas de papel.csv"
    output_pdf = project_root / "output" / "reviews_booklet.pdf"

    reviews = load_reviews(input_csv)
    build_pdf(
        reviews=reviews,
        output_path=output_pdf,
        booklet_title="Alas de papel — Review Booklet",
    )

    print(f"Loaded {len(reviews)} reviews.")
    print(f"PDF created at: {output_pdf}")


if __name__ == "__main__":
    main()
