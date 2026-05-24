======================================================
College Recommendation Dashboard - Architecture & Setup
======================================================

1. Overview
-----------
This project is a College Recommendation Dashboard that displays data about various universities.
The system consists of two main components:
- A Frontend UI: A single HTML file (`College-List-Demo.html`) with embedded CSS and JS.
- A Backend API: A Node.js + Express API that serves Common Data Set (CDS) JSON data from a SQLite database.

2. Architecture
---------------
- Frontend (`My - Production Files`):
  - `College-List-Demo.html`: The main UI. It dynamically renders a list of universities by matching string IDs to 6-digit IPEDS IDs.
  - `assets/`: Contains logo images for each university.
  - `Run-Project.bat`: A convenient Windows batch script to spin up the API and launch the frontend entirely locally (no Docker required).

- Backend (`college-cds-api-main/api`):
  - Exposes RESTful endpoints (e.g., `GET /v1/schools/{ipeds_id}`).
  - Uses a SQLite database (`cds.db`) populated directly from JSON files.
  - The source of truth for university data is located in `college-cds-api-main/data/input/`.

3. Prerequisites (What you need installed)
------------------------------------------
Before running this project, you must install Node.js:
1. Go to https://nodejs.org/
2. Download and install the "LTS" (Long Term Support) version.
3. During installation, leave all default options checked.
(Note: You DO NOT need Docker to run this application. It runs natively on your machine).

4. Step-by-Step Instructions: How to Run the App
------------------------------------------------
Method 1: Using the Automated Script (Easiest)
1. Open the folder `My - Production Files`.
2. Double-click the file named `Run-Project.bat`.
3. A terminal window will open, automatically installing required dependencies, building the database from the JSON files, and starting the API server.
4. After a few seconds, `College-List-Demo.html` will automatically open in your default web browser.

Method 2: Manual Startup (For Troubleshooting)
If the automated script fails, you can run the backend manually.
1. Open Command Prompt (cmd) or PowerShell.
2. Navigate to the API directory:
   cd path\to\college-cds-api-main\api
3. Install dependencies:
   npm install
4. Ingest the JSON data into the database:
   set API_KEY=dev-key-change-me
   set INGEST_DIR=../../data/input
   node src/ingest.js
5. Start the backend server:
   node src/server.js
6. Finally, double-click `College-List-Demo.html` in your file explorer to open the UI.

5. How the Data Works
---------------------
1. When the backend starts, `ingest.js` reads all the `.json` files in `college-cds-api-main/data/input/` and saves them to a local SQLite database (`data/cds.db`).
2. When you view `College-List-Demo.html` in your browser, the Javascript inside the HTML file reaches out to the backend server (running on `http://localhost:8080`) to request the data.
3. The UI receives a JSON object back, unwraps it, and places the data onto the web page dynamically.

6. Adding/Modifying Universities
--------------------------------
To add new schools or update existing data:
1. Add or modify the corresponding JSON files inside `college-cds-api-main/data/input/`.
2. Ensure the JSON format matches the CDS Schema (needs `cds_meta.ipeds_id` and `cds_meta.school_name`).
3. Add a corresponding logo PNG image in `My - Production Files/assets/`.
4. Close the running backend terminal if it's currently open.
5. Re-run `Run-Project.bat` to re-ingest the new JSON data and start the server again.
