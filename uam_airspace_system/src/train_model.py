"""
src/train_model.py
Trains and serializes the XGBoost Conflict Predictor.
"""
import os
import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from xgboost import XGBClassifier

def train_and_export():
    dataset_path = "data/dataset.csv"
    if not os.path.exists(dataset_path):
        from src.generate_data import generate_encounters
        generate_encounters(output_file=dataset_path)

    df = pd.read_csv(dataset_path)
    X = df.drop(columns=["collision_risk"])
    y = df["collision_risk"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print("Training XGBoost Classifier...")
    model = XGBClassifier(
        n_estimators=120,
        max_depth=5,
        learning_rate=0.1,
        subsample=0.8,
        random_state=42,
        eval_metric="mlogloss"
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    print(classification_report(y_test, preds, target_names=["SAFE", "LOW RISK", "HIGH CONFLICT"]))

    os.makedirs("models", exist_ok=True)
    joblib.dump(model, "models/collision_model.pkl")
    print("Model successfully saved to 'models/collision_model.pkl'")

if __name__ == "__main__":
    train_and_export()