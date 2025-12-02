import pandas as pd
import json
import os
import ast 

print("--- Report Data Processing Started (v10 - Fixed Medications List) ---")

# --- 1. Define File Paths ---
DATA_DIR = os.path.join('Dataset')
OUTPUT_FILE = 'disease_info.json'

# Paths to your source CSVs
DESC_PATH = os.path.join(DATA_DIR, 'description.csv')
DIET_PATH = os.path.join(DATA_DIR, 'diets.csv')
MED_PATH = os.path.join(DATA_DIR, 'medications.csv')
PRECAUTION_PATH = os.path.join(DATA_DIR, 'precautions.csv')
WORKOUT_PATH = os.path.join(DATA_DIR, 'workout.csv')
RISK_PATH = os.path.join(DATA_DIR, 'risk_score.csv')

print(f"Report data will be saved to: backend/{OUTPUT_FILE}")

# (Helper functions are unchanged)
def melt_data(df, id_col, col_prefix, value_name):
    value_cols = [col for col in df.columns if col.startswith(col_prefix)]
    if not value_cols:
        print(f"Info: No columns found with prefix '{col_prefix}' in {value_name} file. (This may be expected)")
        return pd.DataFrame(columns=[id_col, value_name])
    print(f"Melting {len(value_cols)} columns from {value_name} file...")
    df_long = df.melt(id_vars=[id_col], value_vars=value_cols, var_name='source_col', value_name=value_name)
    df_long = df_long.dropna(subset=[value_name])
    return df_long

def parse_string_list(series):
    try:
        string_list = series.iloc[0]
        if pd.isna(string_list):
            return []
        return ast.literal_eval(str(string_list))
    except (SyntaxError, ValueError, IndexError) as e:
        print(f"Warning: Could not parse string for group '{series.name}'. Error: {e}.")
        return []
    except Exception as e:
        print(f"General Error parsing string list for group '{series.name}': {e}")
        return []

try:
    # --- 2. Load all CSVs into DataFrames ---
    print("Loading source CSVs...")
    all_dfs = {
        'desc': pd.read_csv(DESC_PATH),
        'diet': pd.read_csv(DIET_PATH),
        'med': pd.read_csv(MED_PATH),
        'precaution': pd.read_csv(PRECAUTION_PATH),
        'workout': pd.read_csv(WORKOUT_PATH),
        'risk': pd.read_csv(RISK_PATH)
    }

    # --- 3. Standardize 'Disease' Column and VALUES ---
    print("Standardizing all 'Disease' columns and values to lowercase...")
    ID_COLUMN = 'Disease' 
    for name, df in all_dfs.items():
        if 'disease' in df.columns:
            df.rename(columns={'disease': 'Disease'}, inplace=True)
        if ID_COLUMN in df.columns:
            df[ID_COLUMN] = df[ID_COLUMN].str.strip().str.lower()
        else:
            print(f"Warning: '{ID_COLUMN}' column not found in {name}.csv")
            
    desc_df = all_dfs['desc']
    diet_df = all_dfs['diet']
    med_df = all_dfs['med']
    precaution_df = all_dfs['precaution']
    workout_df = all_dfs['workout']
    risk_df = all_dfs['risk']

    # --- 4. Process All Data Files ---
    
    # --- Process Precautions (Wide Format) ---
    precaution_long = melt_data(precaution_df, ID_COLUMN, 'Precaution_', 'Precaution')
    precautions_grouped = precaution_long.groupby(ID_COLUMN)['Precaution'].apply(list)

    # --- Process Diets (Long Format with String-List) ---
    print("Processing diets (long format, string-list)...")
    DIET_COL = 'Diet' 
    diets_grouped = diet_df.groupby(ID_COLUMN)[DIET_COL].apply(parse_string_list)

    # --- Process Medications (Long Format with String-List) (FIXED) ---
    print("Processing medications (long format, string-list)...")
    MED_COL = 'Medication' 
    # THIS LINE IS NOW FIXED
    meds_grouped = med_df.groupby(ID_COLUMN)[MED_COL].apply(parse_string_list)
    
    # --- Process Workouts (Long Format with String-List) ---
    print("Processing workouts (long format, string-list)...")
    WORKOUT_COL = 'Workouts' 
    workouts_grouped = workout_df.groupby(ID_COLUMN)[WORKOUT_COL].apply(parse_string_list)

    # --- 5. Process Description and Risk Files (1-to-1 data) ---
    print("Processing descriptions and risk scores...")
    DESC_COL = 'Description' 
    desc_df = desc_df.set_index(ID_COLUMN)
    risk_data_map = risk_df.set_index(ID_COLUMN).to_dict('index')

    # --- 6. Combine into a Master Dictionary ---
    print("Combining all data into a master dictionary...")
    master_data_dict = {}
    
    for disease, row in desc_df.iterrows():
        risk_data = risk_data_map.get(disease, {})
        
        master_data_dict[disease] = {
            "description": row.get(DESC_COL, 'No description available.'),
            "risk_score": int(risk_data.get('risk_score', 0)),
            "severity_level": risk_data.get('severity_level', 'Unknown'),
            "surgery_needed": risk_data.get('surgery_needed', 'Unknown'),
            "emergency": risk_data.get('emergency', 'Unknown'),
            "probability_death_range": risk_data.get('probability_death_range', 'Unknown'),
            "precautions": precautions_grouped.get(disease, []),
            "medications": meds_grouped.get(disease, []), # <-- Will now be a clean list
            "diets": diets_grouped.get(disease, []),
            "workouts": workouts_grouped.get(disease, [])
        }

    # --- 7. Save the Master Dictionary to JSON ---
    print(f"Saving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(master_data_dict, f, indent=4)

    print(f"\n--- ✅ Report Data Processing Finished Successfully ---")
    print(f"Your 'disease_info.json' file is ready and 'medications' is fixed.")

except FileNotFoundError as e:
    print(f"Error: File not found. Make sure this file is present: {e.filename}")
except KeyError as e:
    print(f"--- !!! COLUMN NOT FOUND ERROR !!! ---")
    print(f"Could not find column: {e}. Please check column names in your CSVs.")
except Exception as e:
    print(f"An error occurred: {e}")