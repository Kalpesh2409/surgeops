import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

engine = create_engine(os.getenv("DATABASE_URL"))

with engine.connect() as conn:
    count = conn.execute(text("SELECT COUNT(*) FROM pricing_suggestions")).scalar()
    print(f"Total PricingSuggestion rows: {count}")
    sample = conn.execute(text("SELECT * FROM pricing_suggestions LIMIT 5"))
    for row in sample:
        print(row)
