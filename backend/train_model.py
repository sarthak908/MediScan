import pandas as pd
import numpy as np
import json
import joblib
import os
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier 
from sklearn.metrics import accuracy_score

print("--- Mediscan Model Training Started (v2 - RandomForest) ---")

# --- 1. Define File Paths (FIXED) ---
# Changed 'dataset' to 'Dataset' (capital D)
DATASET_PATH = os.path.join('Dataset', 'Diseases_and_Symptoms_dataset.csv')
ASSET_DIR = os.path.join('..', 'model_assets')

MODEL_PATH = os.path.join(ASSET_DIR, 'disease_model.pkl')
ENCODER_PATH = os.path.join(ASSET_DIR, 'label_encoder.pkl')
SYMPTOM_PATH = os.path.join(ASSET_DIR, 'unique_symptoms.json')

os.makedirs(ASSET_DIR, exist_ok=True)
print(f"Assets will be saved to: {ASSET_DIR}/")

try:
    # --- 2. Load Data ---
    print(f"Loading dataset from: {DATASET_PATH}...")
    df = pd.read_csv(DATASET_PATH)

    # --- 3. Separate Features (X) and Target (y) ---
    X = df.drop('diseases', axis=1)
    y = df['diseases']

    # --- 4. Encode the Target (y) ---
    print("Encoding target variable (diseases)...")
    encoder = LabelEncoder()
    y_encoded = encoder.fit_transform(y)

    # --- 5. Save the Label Encoder ---
    joblib.dump(encoder, ENCODER_PATH)
    print(f"Label encoder saved to {ENCODER_PATH}")

    # --- 6. Save the Feature (Symptom) List ---
    symptom_list = list(X.columns)
    with open(SYMPTOM_PATH, 'w') as f:
        json.dump(symptom_list, f)
    print(f"Symptom list saved to {SYMPTOM_PATH}")
    print(f"Total diseases found: {len(encoder.classes_)}")
    print(f"Total symptoms found: {len(symptom_list)}")

    # --- 7. Split Data into Training and Testing Sets ---
    print("Splitting data into 80% train and 20% test sets...")
    X_train, X_test, y_train, y_test = train_test_split(X, y_encoded, 
                                                        test_size=0.2, 
                                                        random_state=42)
    print(f"Training samples: {X_train.shape[0]}")
    print(f"Testing samples: {X_test.shape[0]}")

    # --- 8. Train the Machine Learning Model (UPGRADED) ---
    print("Training RandomForestClassifier model...")
    model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    
    print("This may take a minute or two...")
    model.fit(X_train, y_train)
    print("Model training complete.")

    # --- 9. Evaluate the Model ---
    print("Evaluating model performance on the test set...")
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"\n--- Model Evaluation Report ---\nNew RandomForest Accuracy: {accuracy * 100:.2f}%")
    
    # --- 10. Save the Trained Model ---
    joblib.dump(model, MODEL_PATH)
    print(f"Trained model saved to {MODEL_PATH}")

    print("\n--- ✅ Training Process Finished Successfully ---")
    print("Your new (smarter) 'disease_model.pkl' is ready.")

except FileNotFoundError:
    print(f"Error: The file '{DATASET_PATH}' was not found.")
    print("Please check your folder structure. Is the folder named 'Dataset' (capital D)?")
except Exception as e:
    print(f"An error occurred: {e}")