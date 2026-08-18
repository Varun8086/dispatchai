import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import pickle

# --- Load data ---
df = pd.read_csv('training/trip_data.csv')

# --- Feature engineering: one-hot encode vehicle_type ---
df_encoded = pd.get_dummies(df, columns=['vehicle_type'], prefix='vehicle')

# --- Define features (X) and target (y) ---
feature_columns = [
    'distance_km', 'hour_of_day', 'day_of_week',
    'vehicle_bike', 'vehicle_car', 'vehicle_scooter', 'vehicle_van'
]
X = df_encoded[feature_columns]
y = df_encoded['eta_minutes']

# --- Split into training and test sets ---
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

print(f"Training set: {len(X_train)} rows")
print(f"Test set: {len(X_test)} rows")

# --- Train the model ---
model = xgb.XGBRegressor(
    n_estimators=100,
    max_depth=5,
    learning_rate=0.1,
    random_state=42
)
model.fit(X_train, y_train)

# --- Evaluate ---
predictions = model.predict(X_test)
mae = mean_absolute_error(y_test, predictions)
r2 = r2_score(y_test, predictions)

print(f"\nModel Evaluation:")
print(f"  Mean Absolute Error: {mae:.2f} minutes")
print(f"  R² Score: {r2:.4f}")

# --- Save the trained model ---
with open('models/eta_model.pkl', 'wb') as f:
    pickle.dump(model, f)

# --- Save the feature column order (critical for consistent predictions later) ---
with open('models/feature_columns.pkl', 'wb') as f:
    pickle.dump(feature_columns, f)

print("\nModel saved to models/eta_model.pkl")