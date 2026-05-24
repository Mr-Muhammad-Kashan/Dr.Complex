/**
 * DreamCollege Database API Client
 * 
 * Provides an industrial-grade interface to securely fetch 
 * structured university records from the local database.
 */

class DreamCollegeAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.isAuthorized = false;
        this.authPromise = this._authorize();
    }
    
    async _authorize() {
        try {
            // Fetch the API configuration from the secure JSON file
            const configResponse = await fetch('database/config.json');
            if (!configResponse.ok) {
                throw new Error("Unable to read database configuration.");
            }
            const config = await configResponse.json();
            
            // Check if the provided key exists in the JSON configuration
            if (config.api_keys && config.api_keys[this.apiKey] && config.api_keys[this.apiKey].status === "active") {
                this.isAuthorized = true;
                console.log(`[DreamCollegeAPI] Successfully connected. Welcome, ${config.api_keys[this.apiKey].owner}!`);
            } else {
                console.error("[DreamCollegeAPI] Connection refused. Invalid or inactive API Key.");
            }
        } catch (error) {
            console.error(`[DreamCollegeAPI] Authorization system failure: ${error.message}`);
        }
    }
    
    /**
     * Fetches a single school record from the database.
     * @param {string} filename The exact filename in the database/records folder.
     * @returns {Promise<Object>} The JSON data for the school.
     */
    async getSchool(filename) {
        // Wait for authorization check to complete
        await this.authPromise;
        
        if (!this.isAuthorized) {
            throw new Error("401 Unauthorized: Valid API key is required to access the database.");
        }
        
        try {
            // Fetch directly from the securely formatted database folder
            const response = await fetch(`database/records/${filename}`);
            
            if (!response.ok) {
                throw new Error(`404 Not Found: Could not locate record '${filename}' in the database.`);
            }
            
            const data = await response.json();
            
            // Validate basic schema structure
            if (!data.cds_meta || !data.cds_admissions) {
                console.warn(`[DreamCollegeAPI] Warning: Record '${filename}' may not strictly adhere to DreamCollege_CDS_Schema_v2.`);
            }
            
            return data;
        } catch (error) {
            console.error(`[DreamCollegeAPI] Failed to fetch record: ${error.message}`);
            throw error;
        }
    }
}

// Export the API client
window.DreamCollegeAPI = DreamCollegeAPI;
