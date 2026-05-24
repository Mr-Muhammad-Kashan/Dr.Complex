import os
import json

records_dir = r"c:\OneDrive\Desktop\Julia Laing\Build College List - Customization\Version (2.0)\My -  Production Files\database\records"

for filename in os.listdir(records_dir):
    if not filename.endswith(".json"):
        continue
    filepath = os.path.join(records_dir, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Ensure cds_meta has UI fields
    meta = data.get("cds_meta", {})
    if "location" not in meta:
        meta["location"] = f"{meta.get('city', 'Unknown')}, {meta.get('state', 'Unknown')}"
    if "ranking" not in meta:
        meta["ranking"] = "N/A"
    if "admission_rate_display" not in meta:
        try:
            rate = data.get("cds_admissions", {}).get("class_size", {}).get("acceptance_rate", 0)
            meta["admission_rate_display"] = f"{round(rate * 100)}%"
        except:
            meta["admission_rate_display"] = "N/A"
    if "logo_url" not in meta:
        meta["logo_url"] = f"https://placehold.co/130x130/5B2BE0/ffffff?text={meta.get('school_name', 'U')[0]}"
    if "logo_mini_url" not in meta:
        meta["logo_mini_url"] = f"https://placehold.co/80x80/5B2BE0/ffffff?text={meta.get('school_name', 'U')[0]}"
    if "category" not in meta:
        meta["category"] = "reach"
        
    data["cds_meta"] = meta
    
    # Ensure factors exist so UI doesn't crash
    if "factors" not in data.get("cds_admissions", {}):
        if "cds_admissions" not in data:
            data["cds_admissions"] = {}
        data["cds_admissions"]["factors"] = {
            "rigor_of_secondary_record": "considered",
            "class_rank": "considered",
            "academic_gpa": "considered",
            "standardized_test_scores": "considered",
            "application_essay": "considered",
            "recommendation": "considered",
            "interview": "considered",
            "extracurricular_activities": "considered",
            "talent_ability": "considered",
            "character_personal_qualities": "considered",
            "first_generation": "considered",
            "alumni_relation": "considered",
            "geographical_residence": "considered",
            "state_residency": "considered",
            "religious_affiliation": "considered",
            "volunteer_work": "considered",
            "work_experience": "considered",
            "level_of_applicant_interest": "considered"
        }

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
print("All JSON files updated for HTML compatibility.")
