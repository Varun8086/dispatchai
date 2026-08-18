import pandas as pd
from prophet import Prophet
import pickle

# --- Load data ---
df = pd.read_csv('training/demand_data.csv')
df['ds'] = pd.to_datetime(df['ds'])

# --- Train/test split: hold out the LAST 7 days for testing ---
# NOTE: for time series, we NEVER randomly split — we must split chronologically,
# otherwise the model could "see the future" during training, which is a serious
# and common mistake in time-series ML.
split_point = df['ds'].max() - pd.Timedelta(days=7)
train_df = df[df['ds'] <= split_point]
test_df = df[df['ds'] > split_point]

print(f"Training rows: {len(train_df)}")
print(f"Test rows: {len(test_df)}")

# --- Train the model ---
model = Prophet(
    daily_seasonality=True,
    weekly_seasonality=True,
    yearly_seasonality=False,  # we only have 90 days of data, not enough for yearly patterns
)
model.fit(train_df)

# --- Forecast the test period ---
future = model.make_future_dataframe(periods=len(test_df), freq='h')
forecast = model.predict(future)

# --- Evaluate on the held-out test period ---
forecast_test = forecast[forecast['ds'] > split_point][['ds', 'yhat']]
comparison = test_df.merge(forecast_test, on='ds')

mae = (comparison['y'] - comparison['yhat']).abs().mean()
mape = ((comparison['y'] - comparison['yhat']).abs() / comparison['y'].replace(0, 1)).mean() * 100

print(f"\nModel Evaluation (on last 7 days, unseen during training):")
print(f"  Mean Absolute Error: {mae:.2f} orders/hour")
print(f"  Mean Absolute Percentage Error: {mape:.1f}%")

# --- Save the trained model ---
with open('models/demand_model.pkl', 'wb') as f:
    pickle.dump(model, f)

# --- Diagnose: is MAPE being inflated by low-volume hours? ---
comparison['abs_error'] = (comparison['y'] - comparison['yhat']).abs()
comparison['pct_error'] = comparison['abs_error'] / comparison['y'].replace(0, 1) * 100

low_volume = comparison[comparison['y'] < 5]
high_volume = comparison[comparison['y'] >= 5]

print(f"\nLow-volume hours (<5 orders): {len(low_volume)} hours, MAPE: {low_volume['pct_error'].mean():.1f}%")
print(f"Higher-volume hours (>=5 orders): {len(high_volume)} hours, MAPE: {high_volume['pct_error'].mean():.1f}%")

print("\nModel saved to models/demand_model.pkl")