import pandas as pd
import numpy as np

np.random.seed(42)

N = 5000  # number of synthetic trips

def generate_trips(n):
    # distance in km — realistic range for intra-city delivery
    distance_km = np.random.uniform(0.5, 25, n)

    # hour of day (0-23) — affects traffic
    hour_of_day = np.random.randint(0, 24, n)

    # vehicle type affects speed
    vehicle_type = np.random.choice(['bike', 'scooter', 'car', 'van'], n, p=[0.4, 0.3, 0.2, 0.1])

    # day of week (0=Monday, 6=Sunday) — weekends have less traffic
    day_of_week = np.random.randint(0, 7, n)

    # base speed (km/h) by vehicle type
    base_speed = {'bike': 25, 'scooter': 30, 'car': 35, 'van': 28}
    speeds = np.array([base_speed[v] for v in vehicle_type])

    # traffic penalty — worse during rush hours (8-10am, 5-8pm), better late night
    rush_hour_penalty = np.where(
        ((hour_of_day >= 8) & (hour_of_day <= 10)) | ((hour_of_day >= 17) & (hour_of_day <= 20)),
        0.5,  # 50% speed reduction during rush hour
        1.0
    )
    late_night_bonus = np.where((hour_of_day >= 23) | (hour_of_day <= 5), 1.3, 1.0)
    weekend_bonus = np.where(day_of_week >= 5, 1.15, 1.0)

    effective_speed = speeds * rush_hour_penalty * late_night_bonus * weekend_bonus

    # base ETA in minutes = (distance / speed) * 60
    base_eta = (distance_km / effective_speed) * 60

    # add realistic random noise (traffic lights, pickup delays, etc.)
    noise = np.random.normal(0, 3, n)
    eta_minutes = np.clip(base_eta + noise, 2, None)  # ETA can't be negative or near-zero

    return pd.DataFrame({
        'distance_km': distance_km,
        'hour_of_day': hour_of_day,
        'day_of_week': day_of_week,
        'vehicle_type': vehicle_type,
        'eta_minutes': eta_minutes,
    })

df = generate_trips(N)
df.to_csv('training/trip_data.csv', index=False)
print(f"Generated {len(df)} synthetic trips")
print(df.head())
print(df.describe())