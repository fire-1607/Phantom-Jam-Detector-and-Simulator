# server/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from typing import List
import uvicorn

app = FastAPI(title="Phantom Jam Segment API")

# Allow CORS for local dev (Phaser served on localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load dataset once at startup
DF = pd.read_csv("dataset.csv", sep=None, engine="python")  # flexible delimiter
REQUIRED_COLS = {"time_step", "road_segment_id", "local_car_density", "average_speed_kmph", "brake_events", "phantom_jam_flag"}
if not REQUIRED_COLS.issubset(set(DF.columns)):
    raise RuntimeError(f"dataset.csv must contain columns: {REQUIRED_COLS}")

# Ensure consistent types
DF["time_step"] = DF["time_step"].astype(int)
DF["road_segment_id"] = DF["road_segment_id"].astype(int)
DF = DF.sort_values(["road_segment_id","time_step"]).reset_index(drop=True)

@app.get("/segment/{segment_id}")
def get_segment(segment_id: int):
    rows = DF[DF["road_segment_id"] == int(segment_id)].copy()
    if rows.empty:
        raise HTTPException(status_code=404, detail=f"No data for segment {segment_id}")
    # convert to list of dicts
    out = rows.to_dict(orient="records")
    return {"segment_id": int(segment_id), "records": out}

if __name__ == "__main__":
    print("Segment API running on http://127.0.0.1:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
