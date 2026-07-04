from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
import joblib
import pandas as pd
from datetime import datetime

load_dotenv()

app = FastAPI(title="SurgeOps ML Service")

model = joblib.load("model.pkl")
store_encoder = joblib.load("store_encoder.pkl")
product_encoder = joblib.load("product_encoder.pkl")

class PredictRequest(BaseModel):
    store_id: str
    product_id: str
    base_price: float
    hour_of_day: int | None = None
    day_of_week: int | None = None

@app.get("/health")
def health():
    return {"status": "ok", "service": "surgeops-ml"}

@app.post("/predict")
def predict(req: PredictRequest):
    now = datetime.now()
    hour_of_day = req.hour_of_day if req.hour_of_day is not None else now.hour
    day_of_week = req.day_of_week if req.day_of_week is not None else now.weekday()
    is_weekend = 1 if day_of_week in [5, 6] else 0

    if req.store_id not in store_encoder.classes_:
        raise HTTPException(status_code=400, detail=f"Unknown store_id: {req.store_id}")
    if req.product_id not in product_encoder.classes_:
        raise HTTPException(status_code=400, detail=f"Unknown product_id: {req.product_id}")

    store_enc = store_encoder.transform([req.store_id])[0]
    product_enc = product_encoder.transform([req.product_id])[0]

    X = pd.DataFrame([{
        "store_id_enc": store_enc,
        "product_id_enc": product_enc,
        "base_price": req.base_price,
        "hour_of_day": hour_of_day,
        "day_of_week": day_of_week,
        "is_weekend": is_weekend
    }])

    predicted_demand = model.predict(X)[0]

    return {
        "store_id": req.store_id,
        "product_id": req.product_id,
        "predicted_demand": round(float(predicted_demand), 2),
        "hour_of_day": hour_of_day,
        "day_of_week": day_of_week,
        "model": "random_forest_v1"
    }
