======================================================
College Recommendation Dashboard - Full Run Guide
======================================================

Hello! This document provides a foolproof, step-by-step guide to running this College Recommendation Dashboard locally on your computer. You do NOT need any advanced technical skills or Docker to run this.

1. What You Need Installed (Prerequisites)
------------------------------------------
Before running this application, your computer must have Node.js installed. Node.js is the engine that runs the backend API.
If you already have it, skip to Step 2.
If you do not have it, or are unsure:
  a. Open your web browser and go to: https://nodejs.org/
  b. Download the installer labeled "LTS" (Recommended for Most Users).
  c. Double-click the downloaded file and follow the installation wizard.
  d. Leave all the default settings checked and keep clicking "Next" until it finishes.

2. How to Run the Application (The Easy Way)
--------------------------------------------
We have created a simple script that automates the entire startup process.
  a. Open the folder named `My - Production Files`.
  b. Locate the file named `Run-Project.bat`.
  c. Double-click `Run-Project.bat`.

What happens next?
  - A black terminal window will appear. This is normal. It is installing the required files, building the database from the JSON files, and starting the API server.
  - Please DO NOT close this black window. It must remain open for the website to work.
  - After approximately 10 seconds, your default web browser will automatically open and display the `College-List-Demo.html` dashboard.
  - The dashboard is now fully functional! You can click on the different universities on the left side, and the data on the right side will dynamically update based on the API.

3. How to Close the Application
-------------------------------
When you are done testing the dashboard:
  a. Close the web browser tab.
  b. Click the "X" button in the top right corner of the black terminal window to stop the backend API.

4. Troubleshooting (If the website doesn't load data)
-----------------------------------------------------
If you open the website but the data doesn't change when you click different universities, it means the backend API did not start properly. Here is how to fix it manually:
  a. Press the Windows Key on your keyboard, type "cmd", and press Enter to open the Command Prompt.
  b. Type `cd ` and then drag the `college-cds-api-main\api` folder from your file explorer into the black window and press Enter.
     (It should look something like: cd C:\Users\Name\Desktop\Project\college-cds-api-main\api)
  c. Type `npm install` and press Enter. Wait for it to finish.
  d. Type `set API_KEY=dev-key-change-me` and press Enter.
  e. Type `set INGEST_DIR=..\data\input` and press Enter.
  f. Type `node src/ingest.js` and press Enter. (You should see a message saying "Ingest complete: 16 ingested").
  g. Type `node src/server.js` and press Enter. (You should see a message saying "College CDS API listening").
  h. Now, go back to your `My - Production Files` folder and double-click `College-List-Demo.html` to open it in your browser. It will work perfectly.

5. How to Update Data
---------------------
If you want to add a new university or change the data for an existing one:
  a. Open the `college-cds-api-main\data\input` folder.
  b. Edit the `.json` files there or add a new one.
  c. Close the running black terminal window to shut down the API.
  d. Double-click `Run-Project.bat` again. The system will automatically detect your changes, update the database, and restart the website!
