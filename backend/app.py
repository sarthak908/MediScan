import os
import json
import joblib
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

# --- 1. Initialize Flask App ---
app = Flask(__name__)
CORS(app) 

# --- 2. Define Asset Paths ---
MODEL_DIR = os.path.join('..', 'model_assets')
MODEL_PATH = os.path.join(MODEL_DIR, 'disease_model.pkl')
ENCODER_PATH = os.path.join(MODEL_DIR, 'label_encoder.pkl')
SYMPTOM_PATH = os.path.join(MODEL_DIR, 'unique_symptoms.json')
REPORT_DATA_PATH = 'disease_info.json'

# --- 3. Load All Assets on Startup ---
print("Loading all model and data assets...")
try:
    model = joblib.load(MODEL_PATH)
    encoder = joblib.load(ENCODER_PATH)
    with open(SYMPTOM_PATH, 'r') as f:
        all_symptoms = json.load(f)
    with open(REPORT_DATA_PATH, 'r') as f:
        report_database = json.load(f)
    print("All assets loaded successfully.")
except FileNotFoundError as e:
    print(f"FATAL ERROR: Could not load assets. {e}")
    exit()
except Exception as e:
    print(f"An unexpected error occurred during loading: {e}")
    exit()

# --- 4. Preprocessing Function ---
def preprocess_input(user_symptoms, all_symptoms_list):
    input_vector = np.zeros(len(all_symptoms_list))
    for symptom in user_symptoms:
        # normalize symptom text to match symptom vocabulary
        try:
            s = str(symptom).strip().lower()
        except Exception:
            continue
        if s in all_symptoms_list:
            idx = all_symptoms_list.index(s)
            input_vector[idx] = 1
    return input_vector.reshape(1, -1)

# --- 5. Define the /predict Endpoint (UPGRADED ERROR HANDLING) ---
@app.route('/predict', methods=['POST'])
def predict_disease():
    try:
        # --- NEW: Check for valid JSON ---
        # silent=True prevents a crash, returns None if JSON is bad
        data = request.get_json(silent=True) 
        if data is None:
            return jsonify({"error": "Invalid JSON format. Please check your request body."}), 400
        
        if 'symptoms' not in data:
            return jsonify({"error": "Missing 'symptoms' key in request."}), 400
        
        user_symptoms = data['symptoms']
        # normalize and validate incoming symptoms
        if not isinstance(user_symptoms, list):
            return jsonify({"error": "'symptoms' must be an array/list."}), 400
        # strip/normalize to lowercase and remove empties
        user_symptoms = [str(s).strip().lower() for s in user_symptoms if s and str(s).strip()]
        # require minimum number of symptoms for a reliable prediction
        if len(user_symptoms) < 4:
            return jsonify({"error": "Please provide at least 4 symptoms for a reliable prediction."}), 400

        # Optional: accept age and pass it through in the response for richer UI
        age = data.get('age', None)
        
        # --- A. Preprocess the input ---
        input_vector = preprocess_input(user_symptoms, all_symptoms)
        
        # --- B. Get Probabilities ---
        probabilities = model.predict_proba(input_vector)[0]
        
        # --- C. Get Top 3 Predictions ---
        top_3_indices = np.argsort(probabilities)[-3:][::-1] 

        # --- D. Generate Report for each of the Top 3 ---
        top_predictions = []
        for i in top_3_indices:
            disease_name = encoder.classes_[i]
            probability_score = probabilities[i]
            
            report_key = disease_name.lower()
            report_data = report_database.get(report_key, {})
            
            prediction_data = {
                "disease_name": disease_name,
                "probability": f"{probability_score * 100:.2f}%",
                "risk_score": report_data.get("risk_score", 0),
                "severity_level": report_data.get("severity_level", "Unknown"),
                "surgery_needed": report_data.get("surgery_needed", "Unknown"),
                "emergency": report_data.get("emergency", "Unknown"),
                "probability_death_range": report_data.get("probability_death_range", "Unknown"),
                "description": report_data.get("description", "No description available."),
                "precautions": report_data.get("precautions", []),
                "medications": report_data.get("medications", []),
                "diets": report_data.get("diets", []),
                "workouts": report_data.get("workouts", [])
            }
            if age is not None:
                prediction_data['age'] = age
            top_predictions.append(prediction_data)

        # --- E. Format and Return Response ---
        return jsonify(top_predictions)

    except Exception as e:
        print(f"Error during prediction: {e}")
        # This is the generic error that was triggered before.
        return jsonify({"error": "An internal server error occurred."}), 500

# --- 6. Define a Simple Root Route for Testing ---
@app.route('/', methods=['GET'])
def index():
    return "Mediscan Backend (v3 - Risk Score) is running. Use the /predict endpoint."
@app.route('/symptoms', methods=['GET'])
def get_symptoms():
    try:
        return jsonify(all_symptoms)
    except Exception as e:
        print(f"Error returning symptoms: {e}")
        return jsonify({"error": "Could not load symptoms."}), 500

# --- 7. Run the App ---
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)