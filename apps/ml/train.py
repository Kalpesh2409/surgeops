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

    store_encoder = LabelEncoder()
    product_encoder = LabelEncoder()
    df["store_id_enc"] = store_encoder.fit_transform(df["store_id"])
    df["product_id_enc"] = product_encoder.fit_transform(df["product_id"])

    features = ["store_id_enc", "product_id_enc", "base_price", "hour_of_day", "day_of_week", "is_weekend"]
    X = df[features]
    y = df["total_quantity"]

    return X, y, store_encoder, product_encoder

if __name__ == "__main__":
    X, y, store_encoder, product_encoder = prepare_training_data()
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
    print("Model and encoders saved.")
