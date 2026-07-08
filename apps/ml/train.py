import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error
from sklearn.preprocessing import LabelEncoder
import joblib
from build_features import load_raw_data, add_time_features

def prepare_training_data():
    df = load_raw_data()
    df = add_time_features(df)

    # Compute historical average demand per store+product BEFORE encoding,
    # using the raw string IDs — this is what /predict will look up by,
    # to convert a raw predicted_demand into a ratio relative to "normal"
    # demand for that specific store+product.
    avg_demand = (
        df.groupby(["store_id", "product_id"])["total_quantity"]
        .mean()
        .to_dict()
    )

    store_encoder = LabelEncoder()
    product_encoder = LabelEncoder()
    df["store_id_enc"] = store_encoder.fit_transform(df["store_id"])
    df["product_id_enc"] = product_encoder.fit_transform(df["product_id"])

    features = ["store_id_enc", "product_id_enc", "base_price", "hour_of_day", "day_of_week", "is_weekend"]
    X = df[features]
    y = df["total_quantity"]

    return X, y, store_encoder, product_encoder, avg_demand

if __name__ == "__main__":
    X, y, store_encoder, product_encoder, avg_demand = prepare_training_data()
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    print(f"Test MAE: {mae:.3f} units")
    print(f"Mean actual demand: {y_test.mean():.3f} units")

    joblib.dump(model, "model.pkl")
    joblib.dump(store_encoder, "store_encoder.pkl")
    joblib.dump(product_encoder, "product_encoder.pkl")
    joblib.dump(avg_demand, "avg_demand.pkl")
    print(f"Model, encoders, and avg_demand lookup ({len(avg_demand)} store-product pairs) saved.")