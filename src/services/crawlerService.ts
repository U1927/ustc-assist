
import { ScheduleItem } from '../types';

/**
 * CRAWLER SERVICE (Serverless Mode)
 * 
 * Since there is no backend server, we cannot bypass CORS to fetch data directly.
 * This file now serves as a placeholder or utility for client-side data handling.
 * 
 * Data synchronization is done via Manual Copy-Paste in the ImportDialog.
 */

// Placeholder for potential future client-side extensions or browser extensions
export const getInstructions = (system: 'jw' | 'yjs') => {
    if (system === 'jw') {
        return "1. Login to jw.ustc.edu.cn\n2. Open DevTools (F12) -> Network\n3. Refresh page\n4. Find request named 'get-data'\n5. Copy the Response JSON.";
    }
    if (system === 'yjs') {
        return "1. Login to Graduate System (yjs1.ustc.edu.cn)\n2. Go to 'Student Course Schedule'\n3. Right-click page -> View Page Source (Ctrl+U)\n4. Copy ALL HTML code.";
    }
    return "";
};

