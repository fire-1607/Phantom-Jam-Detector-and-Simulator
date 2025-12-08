"""
DBSCAN Phantom Jam Detection with 80/20 split evaluation.

Outputs:
- Accuracy
- F1 Score
- Jams detected (True Positive)
- Jams missed (False Negative)
- False positive jams (False Positive)
- Correct non-jams (True Negative)
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import DBSCAN
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix, accuracy_score, f1_score
import joblib


# ================== LOAD DATA ==================

df = pd.read_csv("/kaggle/input/dataset/dataset.csv")   # Update path if needed

required_cols = {"local_car_density", "average_speed_kmph", "brake_events", "phantom_jam_flag"}
if not required_cols.issubset(set(df.columns)):
    raise ValueError(f"dataset must contain columns: {required_cols}")

# Features for DBSCAN
FEATURES = ["local_car_density", "average_speed_kmph", "brake_events"]

X = df[FEATURES].values
y = df["phantom_jam_flag"].values   # 0 = normal, 1 = phantom jam


# ================== TRAIN/TEST SPLIT (80/20) ==================

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, shuffle=True, stratify=y, random_state=42
)

# Scale features (important for DBSCAN)
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)


# ================== TRAIN DBSCAN (only on NON-JAM data) ==================

normal_train = X_train_scaled[y_train == 0]   # train only on normal traffic

dbscan = DBSCAN(eps=0.55, min_samples=4)
dbscan.fit(normal_train)

core_samples = dbscan.components_   # these represent "normal traffic space"


# ================== FUNCTION: distance to nearest core ==================

def anomaly_score(X, cores):
    # Compute MIN Euclidean distance to any core point
    dif = X[:, None, :] - cores[None, :, :]
    dist2 = np.sum(dif * dif, axis=2)
    return np.sqrt(np.min(dist2, axis=1))


# ================== THRESHOLD SELECTION ==================

dist_train = anomaly_score(X_train_scaled, core_samples)

jam_distances = dist_train[y_train == 1]
if len(jam_distances) == 0:
    threshold = np.percentile(dist_train, 95)
else:
    threshold = np.percentile(jam_distances, 30)  # make jams easier to detect

print(f"\n✅ Using distance threshold = {threshold:.4f}\n")


# ================== PREDICT ON TEST SET ==================

dist_test = anomaly_score(X_test_scaled, core_samples)
y_pred = (dist_test > threshold).astype(int)


# ================== METRICS ==================

acc = accuracy_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred)  # <-- F1 score added
cm = confusion_matrix(y_test, y_pred)

TN, FP, FN, TP = cm.ravel()

print("========== DBSCAN PHANTOM JAM DETECTION ==========")
print(f"Accuracy: {acc*100:.2f}%")
print(f"F1 Score: {f1:.4f}")
print("")
print("Confusion Matrix (rows = actual, cols = predicted):")
print("              Predicted Normal | Predicted Jam")
print(f"Actual Normal   :     {TN}           |      {FP}")
print(f"Actual Jam      :     {FN}           |      {TP}")
print("")
print("---------- Summary ----------")
print(f"✅ Phantom jams detected (True Positive): {TP}")
print(f"❌ Phantom jams missed   (False Negative): {FN}")
print(f"⚠️ False alarms (False Positive): {FP}")
print(f"✅ Correct non-jams (True Negative): {TN}")

# save model
joblib.dump((scaler, core_samples, threshold), "dbscan_jam_model.joblib")
print("\nModel saved as: dbscan_jam_model.joblib")
