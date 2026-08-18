from fastapi import FastAPI
from pydantic import BaseModel
import pickle
import pandas as pd
from datetime import datetime, timedelta

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



# --- Load the demand model alongside the ETA model ---
with open('models/demand_model.pkl', 'rb') as f:
    demand_model = pickle.load(f)


class DemandForecastRequest(BaseModel):
    hours_ahead: int = 24  # how many hours into the future to forecast


@app.post("/forecast-demand")
def forecast_demand(request: DemandForecastRequest):
    future = demand_model.make_future_dataframe(periods=request.hours_ahead, freq='h')
    forecast = demand_model.predict(future)

    # only return the newly forecasted (future) rows, not the historical fit
    future_forecast = forecast.tail(request.hours_ahead)[['ds', 'yhat', 'yhat_lower', 'yhat_upper']]

    results = []
    for _, row in future_forecast.iterrows():
        results.append({
            "timestamp": row['ds'].isoformat(),
            "predicted_orders": max(0, round(row['yhat'], 1)),
            "lower_bound": max(0, round(row['yhat_lower'], 1)),
            "upper_bound": round(row['yhat_upper'], 1),
        })

    return {"forecast": results}


@app.get("/surge-multiplier")
def get_surge_multiplier():
    # forecast just the next hour
    future = demand_model.make_future_dataframe(periods=1, freq='h')
    forecast = demand_model.predict(future)
    predicted_next_hour = max(0, forecast.iloc[-1]['yhat'])

    # simple, transparent surge logic based on predicted demand thresholds
    if predicted_next_hour >= 50:
        multiplier = 1.8
    elif predicted_next_hour >= 35:
        multiplier = 1.4
    elif predicted_next_hour >= 20:
        multiplier = 1.1
    else:
        multiplier = 1.0

    return {
        "predicted_orders_next_hour": round(predicted_next_hour, 1),
        "surge_multiplier": multiplier,
    }