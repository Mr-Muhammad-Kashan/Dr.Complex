# data/input/

**This folder is the source of truth for school CDS data going into the API.**

Drop one JSON file per school here. On the next `npm run docker:start`, the build pipeline will:

1. Stage every `*.json` from this folder into `api/seed/`
2. Bake a fresh `cds.db` into the Docker image during build
3. Stamp the image with a new `BUILD_ID`
4. On container start, detect the `BUILD_ID` mismatch and **wipe + reload** the SQLite volume from the baked DB

The result: edit/add/remove JSONs here, rebuild, and the running API reflects the new data — no manual `admin.sh` commands needed for routine refreshes.

## File format

Each file must match the canonical CDS template — see `College API Design/DreamCollege_CDS_Template V1.0.json` for the full schema. Minimum required fields under `cds_meta`:

- `ipeds_id` (string, 6-digit NCES code — primary key)
- `cds_year` (string, e.g. `"2024-2025"`)
- `school_name` (string)

The 9 university files included as starter content are working examples copied from `College API Design/10 Json files for Universities/`.

## File naming

There's no strict naming convention. Convention used by the starter set is `<SchoolName>_CDS_<YYYY-YYYY>.json` (e.g. `HarvardUniversity_CDS_2024-2025.json`), but the API keys off `cds_meta.ipeds_id` and `cds_meta.cds_year` inside the JSON, not the filename.

## Ad-hoc edits without rebuilding

If you need to add or modify one record without a full image rebuild, use the admin utility against the running container:

```bash
cd api
bash scripts/admin.sh upsert ./path/to/school.json
bash scripts/admin.sh delete 166027
```

Those edits survive until the next rebuild, when `data/input/` reasserts itself as the source of truth.

## Gitignored

The `*.json` files in this folder are gitignored. Only this README and `.gitkeep` are tracked.
