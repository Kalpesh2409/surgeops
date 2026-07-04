import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import pandas as pd

load_dotenv()

engine = create_engine(os.getenv("DATABASE_URL"))

QUERY = """
SELECT
    o."storeId" AS store_id,
    oi."productId" AS product_id,
    p."basePrice" AS base_price,
    date_trunc('hour', o."placedAt") AS hour_bucket,
    SUM(oi.quantity) AS total_quantity
FROM orders o
JOIN order_items oi ON oi."orderId" = o.id
JOIN products p ON p.id = oi."productId"
WHERE o.status = 'DELIVERED'
GROUP BY o."storeId", oi."productId", p."basePrice", hour_bucket
ORDER BY hour_bucket
"""

def load_raw_data():
    with engine.connect() as conn:
        df = pd.read_sql(text(QUERY), conn)
    return df

def add_time_features(df):
    df["hour_bucket"] = pd.to_datetime(df["hour_bucket"])
    df["hour_of_day"] = df["hour_bucket"].dt.hour
    df["day_of_week"] = df["hour_bucket"].dt.dayofweek
    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)
    return df

if __name__ == "__main__":
    df = load_raw_data()
    print(f"Loaded {len(df)} store-product-hour rows")
    df = add_time_features(df)
    print(df.head(10))
    print(df.describe(include="all"))
