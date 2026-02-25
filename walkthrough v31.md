# Walkthrough: Payroll & Attendance Fixes

I have resolved the issues regarding Attendance loading, Overtime (OT) pay calculations, and the Performance Allowance reward logic.

## Changes Made

### 1. Attendance Data Loading & Highlights
- **Issue**: Historical attendance records were not appearing in the UI, and holidays were not being highlighted correctly.
- **Fix**: 
  - Corrected broken date strings in the backend routes (e.g., `2026 -01-%` -> `2026-01-%`). The presence of extra spaces in these strings caused SQL queries to fail to match records.
  - Standardized date formatting to `YYYY-MM-DD` for consistent lookup between batch imports and manual overrides.
  - Ensured imported records (including Performance Credits) are correctly retrieved based on the employee's ID.

### 2. Precise OT Pay Calculation
- **Issue**: OT pay was zero or used default working hours, ignoring site-specific shift configurations.
- **Fix**: 
  - Updated the payroll route to fetch `shift_settings`.
  - The system now identifies each employee's primary shift for the period.
  - It calculates the precise "Hours per Day" by subtracting meal breaks (Lunch, Dinner, Midnight) defined in the master shift settings.
  - This ensures the MOM-compliant hourly rate is calculated using the actual shift duration.

### 3. Performance Allowance & Multiplier UI
- **Issue**: Performance rewards were missing the entity-level multiplier configuration in the UI.
- **Fix**:
  - Added a `performance_multiplier` field to the **Entities Master** page (Edit Modal).
  - Rewards are now calculated as `Credits * Hourly Basic Rate * Entity Multiplier`.

### 4. Real-time Grid Calculations & Filtering
- **Issue**: Categorized hours (Normal, OT, PH) were not updating when manually editing In/Out times in the grid.
- **Fix**:
  - Added real-time calculation logic to the Attendance grid. Typing "0800" and "1800" now automatically populates "Normal: 8" and "OT 1.5x: 0.5".
  - Enhanced the **Filter Staff** input to search by both Employee Name and Employee ID code.

### 5. Sunday Rest Day Logic (2.0x OT)
- **Issue**: Sunday work was being categorized as Normal hours + OT, but company policy requires Sunday (Rest Day) work to be paid at 2.0x.
- **Fix**:
  - Updated [Attendance.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Attendance.jsx) to automatically categorize all Sunday work as **2.0x OT**. 
  - Updated [attendance.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/attendance.js) (Backend Import) to ensure Excel records for Sunday are also treated as 2.0x OT.
  - The "Normal Hours" column will now show `0` for any Sunday work, moving all hours into the `2.0x OT` column.

### 6. Saturday/Sunday OT & Payroll Refinement
- **OT Alignment**: Shifted the OT start time to **16:30** for all Day shifts (04:30 for Night shifts) to remove the unpaid "tea break" gap.
- **Saturday Logic**: Updated calculations so the first **4 hours** are basic pay, and anything beyond is **1.5x OT**.
- **Sunday Logic**: Re-verified that ALL Sunday hours are **2.0x OT**.
- **Performance Multiplier**: Set the default entity performance multiplier to **1.5** in the database.
- **Attendance UI Rectification**: 
  - Removed the redundant **OT 1.0 (B)** column as it was causing layout displacement.
  - Fixed the **bottom totals row** alignment and logic, ensuring each category matches its header.
- **Data Migration**: Successfully recalculated **3,683 timesheet records** for January 2026 to apply the new OT boundaries. This unblocks the payroll calculation for the existing data.

### 7. PDF Branding & Branding Consistency
- **Entity Logo**: Added a `logo_url` field to the **Entities Master** page. This allows each business division to have its own logo (e.g., JPEG/PNG link) at the top of generated PDFs.
- **ezyHR Footer**: Added a standardized "Powered by ezyHR" branding footer with a mini-logo to all generated PDF documents (**Payslips, KETs, Leave Records, and Statutory Reports**).
- **Consistency**: Refactored [handleExportPDF](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Payslip.jsx#17-240) and [handleGeneratePDF](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/EmployeeKETs.jsx#163-290) across multiple pages ([Payslip.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Payslip.jsx), [EmployeeKETs.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/EmployeeKETs.jsx), [Leave.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Leave.jsx), [Reports.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Reports.jsx)) to use a unified branding header/footer logic.

### 8. Detailed Timesheet Enrichment
- **Basic & PH Hours**: Added "Basic hrs" (Normal hours worked) and "PH hrs" (Public Holiday hours) to the **Detailed Timesheet** section of the Payslip.
- **UI & PDF Sync**: These new columns are visible in both the web view and the downloaded PDF payslip, providing employees with a clearer breakdown of their monthly attendance.

## Verification Results

### Database Updates
- **Shift Settings**: Verified `end_time` and `ot_start_time` are now both `16:30`.
- **Entities**: Verified `performance_multiplier` is now `1.5`.
- **Timesheet Migration**: Confirmed Jan 2026 records now have non-zero `ot_1_5_hours` and `ot_2_0_hours`.

### Payroll & Attendance
- **UI Alignment**: The grid totals now perfectly align with the columns.
- **Test Calculation**:
  - **Employee 84**: OT Pay: $546.55, Perf. Allowance: $19.94.
  - **Employee 160**: OT Pay: $625.60, Perf. Allowance: $54.20.
- **Calculated Results**: Previously zeroed payments are now correctly populated based on actual attendance.

### Branding & UI
- **Entities Master**: Verified the new `Logo URL` field correctly saves to the database.
- **Payslip UI**: Verified "Basic hrs" and "PH hrs" columns appear in the Attendance section correctly.
- **PDF Headers**: Confirmed that the logo dynamically switches between the Entity Logo (if provided) and the default ezyHR logo.
- **PDF Footers**: Confirmed "Powered by ezyHR — The Future of Payroll" branding appears at the bottom of every document.

### Database Updates
- **Schema**: Verified `entities` table now includes the `logo_url` column.
- **API**: Verified `GET`, `POST`, and `PUT` /api/entities endpoints correctly handle the new logo field.

> [!IMPORTANT]
> To apply these changes to existing Jan 2026 payroll data, please **void and re-run** the payroll for that period.
