# Customizable Global Shift Fallbacks

The user has requested the ability to customize the default global Day/Night shift timings and penalty thresholds since site-wise hours are not fully setup yet. These need to be configured at the company/entity level.

## Proposed Changes

### Database Schema Updates
Create a new `shift_settings` table to store master shift configurations per entity.

#### [MODIFY] [server/db/init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js)
- Create `shift_settings` table:
  - [id](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/services/api.js#187-201) (PK)
  - `entity_id` (FK to entities)
  - `shift_name` (e.g., "Day", "Night", "Split")
  - `start_time`, `end_time` (String HH:mm)
  - `ot_start_time` (String HH:mm)
  - `late_arrival_threshold_mins`, `early_departure_threshold_mins` (Integer)
  - `late_arrival_penalty_block_mins`, `early_departure_penalty_block_mins` (Integer)
  - `compulsory_ot_hours` (Real)
- Add a migration check. If table doesn't exist, create it and seed with the default "Day" and "Night" records for existing entities.

### Backend API Updates

#### [NEW] [server/routes/shift_settings.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/shift_settings.js)
- Create standard CRUD routes (`GET`, `POST`, `PUT`, `DELETE`) protecting by `entity_id`.

#### [MODIFY] [server/index.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/index.js)
- Register use of the new `/api/shift-settings` route.

#### [MODIFY] [server/routes/attendance.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/attendance.js)
- During batch import and manual override, query `shift_settings` for the authorized `entityIds`.
- Build a fast-lookup map: `globalShifts[\`{entity_id}_{shift_name}\`]`.
- If a site config is missing, look up `globalShifts` first. If still missing, fall back to hardcoded minimal defaults.

### UI Configuration

#### [NEW] [client/src/pages/ShiftSettings.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/ShiftSettings.jsx)
- Build a Master Data management page (similar to Leave Policies or Employee Grades).
- Provide a responsive data table listing configured shifts.
- Provide Add/Edit modals to configure timings and penalty thresholds.

#### [MODIFY] `client/src/components/Sidebar.jsx`
- Add "Shift Configurations" to the "Master Setup" collapsible menu.

## Sunday Rest Day Logic
Ensuring all hours worked on Sunday are categorized as 2.0x OT, as Sunday is a rest day for all employees.

### [MODIFY] [client/src/pages/Attendance.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Attendance.jsx)
- Update [calculateCategorizedHours](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Attendance.jsx#215-289) to detect Sunday (`dayOfWeek === 0`).
- For Sundays, set `normal_hours` to 0 and move all worked hours into `ot_2_0_hours`.

### [MODIFY] [server/routes/attendance.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/attendance.js)
- Update the import logic to treat Sunday as a rest day.
- Set `normalHours = 0` and calculate all worked duration as `ot20Hours`.

## Verification Plan
1. Manually enter "0800" and "1700" for a Sunday in the Attendance grid.
2. Verify "Normal" is 0 and "2.0x OT" shows 9.0 (or 8.0 depending on break).
3. Import an Excel file with Sunday records and verify categorization in the UI.
