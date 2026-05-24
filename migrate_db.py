import os
import json
import glob

# Paths
source_dirs = [
    r"c:\OneDrive\Desktop\Julia Laing\Build College List - Customization\Version (2.0)\My -  Production Files\JSON",
    r"c:\OneDrive\Desktop\Julia Laing\Build College List - Customization\Version (2.0)\Julia - Files\JSON - Files"
]
dest_dir = r"c:\OneDrive\Desktop\Julia Laing\Build College List - Customization\Version (2.0)\My -  Production Files\database\records"

os.makedirs(dest_dir, exist_ok=True)

schema_keys = [
    "cds_meta",
    "cds_admissions",
    "cds_academics",
    "cds_financials",
    "cds_outcomes"
]

processed_files = set()

for d in source_dirs:
    if not os.path.exists(d):
        continue
    for filepath in glob.glob(os.path.join(d, "*.json")):
        filename = os.path.basename(filepath)
        if filename in processed_files or filename == "school_data.js":
            continue
            
        with open(filepath, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                continue
                
        # Ensure it has base schema shape
        clean_data = {}
        for k in schema_keys:
            if k in data:
                clean_data[k] = data[k]
            else:
                clean_data[k] = {}

        # Fill missing critical meta
        if "school_name" not in clean_data["cds_meta"]:
            clean_data["cds_meta"]["school_name"] = filename.replace("_CDS_2024-2025.json", "").replace("_CDS_2025-2026.json", "")
        if "ipeds_id" not in clean_data["cds_meta"]:
            clean_data["cds_meta"]["ipeds_id"] = "000000"
            
        # Write to new database
        dest_path = os.path.join(dest_dir, filename)
        with open(dest_path, 'w', encoding='utf-8') as f:
            json.dump(clean_data, f, indent=2)
            
        processed_files.add(filename)

print(f"Migrated {len(processed_files)} JSON files to {dest_dir}")
