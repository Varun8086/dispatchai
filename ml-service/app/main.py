from fastapi import FastAPI
from pydantic import BaseModel
import pickle
import pandas as pd

app = FastAPI(title="DispatchAI ML Service")

# --- Load the trained model and feature columns at startup ---
with open('models/eta_model.pkl', 'rb') as f:
    model = pickle.load(f)

with open('models/feature_columns.pkl', 'rb') as f:
    feature_columns = pickle.load(f)


# --- Define the expected request shape ---
class ETARequest(BaseModel):
    distance_km: float
    hour_of_day: int
    day_of_week: int
    vehicle_type: str


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/predict-eta")
def predict_eta(request: ETARequest):
    # build a single-row dataframe matching training format
    input_data = pd.DataFrame([{
        'distance_km': request.distance_km,
        'hour_of_day': request.hour_of_day,
        'day_of_week': request.day_of_week,
        'vehicle_bike': 1 if request.vehicle_type == 'bike' else 0,
        'vehicle_car': 1 if request.vehicle_type == 'car' else 0,
        'vehicle_scooter': 1 if request.vehicle_type == 'scooter' else 0,
        'vehicle_van': 1 if request.vehicle_type == 'van' else 0,
    }])

    # ensure column order matches exactly what the model was trained on
    input_data = input_data[feature_columns]

    prediction = model.predict(input_data)[0]

    return {
        "eta_minutes": round(float(prediction), 1),
        "distance_km": request.distance_km,
        "vehicle_type": request.vehicle_type,
    }