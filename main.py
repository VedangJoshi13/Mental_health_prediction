from pathlib import Path
from typing import Literal

import joblib
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Load the model from the same folder as this file, so the server works
# no matter which directory uvicorn is started from.
MODEL_PATH = Path(__file__).resolve().parent / "Mental_Health_Model.pkl"
model = joblib.load(MODEL_PATH)

top_countries = ["Other", "India", "USA", "Canada", "Australia", "UK", "Germany", "Mexico", "Turkey", "France"]

# Columns the trained pipeline expects, in the order it was fitted with.
FEATURE_COLUMNS = [
    "Age",
    "Gender",
    "Academic_Level",
    "Most_Used_Platform",
    "Purpose_Of_Use",
    "Avg_Daily_Usage_Hours",
    "Daily_Unlocks",
    "Study_Hours",
    "Physical_Activity_Hours",
    "Sleep_Hours_Per_Night",
    "Stress_Level",
    "Grouped_Country",
]

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # local development only
    allow_methods=["*"],
    allow_headers=["*"],
)


class StudentData(BaseModel):
    age: int = Field(..., ge=0, le=120, description="Age of the student")
    gender: Literal["Male", "Female", "Other"] = Field(..., description="Gender of the student")
    country: str = Field(..., description="Country of the student")
    academic_level: Literal["High School", "Undergraduate", "Graduate", "Postgraduate"] = Field(
        ..., description="Academic level of the student"
    )
    most_used_platform: Literal[
        "Facebook", "Instagram", "Twitter", "Snapchat", "TikTok", "YouTube", "LinkedIn",
        "LINE", "KakaoTalk", "VKontakte", "WhatsApp", "WeChat", "Other",
    ] = Field(..., description="Most used social media platform")
    purpose_of_use: Literal["Socializing", "Entertainment", "News", "Education", "Work", "Other"] = Field(
        ..., description="Purpose of social media use"
    )
    avg_daily_usage_hours: float = Field(..., ge=0, le=24)
    daily_unlocks: int = Field(..., ge=0)
    study_hours: float = Field(..., ge=0, le=24)
    physical_activity_hours: float = Field(..., ge=0, le=24)
    sleep_hours_per_night: float = Field(..., ge=0, le=24)
    stress_level: Literal["Low", "Medium", "High", "Very High"] = Field(..., description="Stress level of the student")


class PredictionResponse(BaseModel):
    predicted_mental_health_score: float


@app.post("/predict", response_model=PredictionResponse)
def predict(data: StudentData):
    grouped_country = data.country if data.country in top_countries else "Other"

    input_row = pd.DataFrame([{
        "Age": data.age,
        "Gender": data.gender,
        "Academic_Level": data.academic_level,
        "Most_Used_Platform": data.most_used_platform,
        "Purpose_Of_Use": data.purpose_of_use,
        "Avg_Daily_Usage_Hours": data.avg_daily_usage_hours,
        "Daily_Unlocks": data.daily_unlocks,
        "Study_Hours": data.study_hours,
        "Physical_Activity_Hours": data.physical_activity_hours,
        "Sleep_Hours_Per_Night": data.sleep_hours_per_night,
        "Stress_Level": data.stress_level,
        "Grouped_Country": grouped_country,
    }], columns=FEATURE_COLUMNS)

    prediction = model.predict(input_row)[0]
    return PredictionResponse(predicted_mental_health_score=round(float(prediction), 2))