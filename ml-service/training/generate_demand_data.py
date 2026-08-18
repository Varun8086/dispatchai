import pandas as pd
import numpy as np
from datetime import datetime, timedelta

np.random.seed(42)

# Generate 90 days of hourly order counts
start_date = datetime(2026, 5, 1)
hours = 90 * 24

timestamps = [start_date + timedelta(hours=i) for i in range(hours)]

def generate_order_volume(timestamps):
    volumes = []
    for ts in timestamps:
        hour = ts.hour
        day_of_week = ts.weekday()  # 0=Monday, 6=Sunday

        # base demand
        base = 15

        # daily pattern: lunch rush (12-14) and dinner rush (19-22) are peak
        if 12 <= hour <= 14:
            hour_factor = 2.2
        elif 19 <= hour <= 22:
            hour_factor = 2.8
        elif 0 <= hour <= 5:
            hour_factor = 0.2  # very low demand overnight
        else:
            hour_factor = 1.0

        # weekend pattern: Friday/Saturday nights are busier
        if day_of_week in [4, 5] and hour_factor > 1.5:
            weekend_factor = 1.4
        else:
            weekend_factor = 1.0

        # slow overall growth trend over the 90 days (platform growing)
        days_elapsed = (ts - start_date).days
        growth_factor = 1 + (days_elapsed / 90) * 0.3  # up to 30% growth by day 90

        expected = base * hour_factor * weekend_factor * growth_factor

        # Poisson noise — realistic for count data (order counts are discrete events)
        actual = np.random.poisson(max(expected, 0.1))
        volumes.append(actual)

    return volumes

order_counts = generate_order_volume(timestamps)

df = pd.DataFrame({
    'ds': timestamps,  # Prophet requires this exact column name for the timestamp
    'y': order_counts,  # Prophet requires this exact column name for the value to forecast
})

df.to_csv('training/demand_data.csv', index=False)
print(f"Generated {len(df)} hourly data points")
print(df.head(10))
print(f"\nMean orders/hour: {df['y'].mean():.2f}")
print(f"Max orders/hour: {df['y'].max()}")