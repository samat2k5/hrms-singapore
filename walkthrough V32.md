# Fixes for Logo Display and Payroll Groups

I have resolved the issues where the entity logo was not appearing in PDFs and the "Group" dropdown was empty for certain entities in the Payroll section.

## 1. Resolved Payroll Group Loading
Some entities were missing default employee groups (like "General"), which caused the "Group" dropdown in the Payroll section to be empty.

- **Action**: Implemented a self-healing migration in [init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js) that automatically seeds "General", "Executive", and "Operations" groups for any entity that lacks them.
- **Result**: The "Group" dropdown will now be correctly populated for all entities.

## 2. Fixed Logo Display in PDFs
Logos were not appearing because of a race condition in the PDF generation logic: the code was trying to add the image to the PDF before the browser had finished loading it. Additionally, some entities had invalid local file paths set as their logo URLs.

- **Action**: 
    - Implemented a robust [loadLogo](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Leave.jsx#9-18) helper function in [Payslip.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Payslip.jsx), [EmployeeKETs.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/EmployeeKETs.jsx), [Leave.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Leave.jsx), and [Reports.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Reports.jsx).
    - This function ensures the PDF generation **waits** for the logo to fully load before proceeding.
    - Updated the file format detection to support both PNG and JPEG correctly.
- **Guidance**: Please ensure that in the **Entity Master**, you set the **Logo URL** to a valid web link (e.g., `https://example.com/logo.png`) or a Base64 data URI. Local paths (like `C:\Users\...`) cannot be loaded by the browser for security reasons.

## Verification
- **Groups**: I verified via database query that "Hypex Engineering Pte Ltd" and other entities now have their default groups.
- **Logos**: The PDF generation logic is now asynchronous and will wait for any valid URL to load before embedding it.

Please refresh the application and verify these changes!
