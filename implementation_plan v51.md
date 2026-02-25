# Customizable Global Shift Fallbacks

The user has requested the ability to customize the default global Day/Night shift timings and penalty thresholds since site-wise hours are not fully setup yet. These need to be configured at the company/entity level.

## Proposed Changes

### Database Schema Updates
Create a new `shift_settings` table to store master shift configurations per entity.

#### [MODIFY] [server/db/init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js)
- Create `shift_settings` table:
  - [id](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/services/api.js#179-193) (PK)
  - `entity_id` (FK to entities)
  - `shift_name` (e.g., "Day", "Night", "Split")
  - `start_time`, `end_time` (String HH:mm)
  - `ot_start_time` (String HH:mm)
  - `late_arrival_threshold_mins`, `early_departure_threshold_mins` (Integer)
  - `late_arrival_penalty_block_mins`, `early_departure_penalty_block_mins` (Integer)
  - `compulsory_ot_hours` (Real)
- Add a migration check. If table doesn't exist, create it and seed with the default "Day" and "Night" records for existing entities.

### Backend API Updates

#### [NEW] `server/routes/shift_settings.js`
- Create standard CRUD routes (`GET`, `POST`, `PUT`, `DELETE`) protecting by `entity_id`.

#### [MODIFY] [server/index.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/index.js)
- Register use of the new `/api/shift-settings` route.

#### [MODIFY] [server/routes/attendance.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/attendance.js)
- During batch import and manual override, query `shift_settings` for the authorized `entityIds`.
- Build a fast-lookup map: `globalShifts[\`{entity_id}_{shift_name}\`]`.
- If a site config is missing, look up `globalShifts` first. If still missing, fall back to hardcoded minimal defaults.

### UI Configuration

#### [NEW] `client/src/pages/ShiftSettings.jsx`
- Build a Master Data management page (similar to Leave Policies or Employee Grades).
- Provide a responsive data table listing configured shifts.
- Provide Add/Edit modals to configure timings and penalty thresholds.

#### [MODIFY] `client/src/components/Sidebar.jsx`
- Add "Shift Configurations" to the "Master Setup" collapsible menu.

## Verification Plan
1. Edit the "Singapore Office" entity via the UI and modify the Default Day Shift start time to `09:00`.
2. Import a timesheet with an `08:30` arrival without an explicitly linked `site_id`.
3. Check the resulting `timesheets` row in the database/UI to ensure `late_mins` is `0` (since arrival `08:30` is before `09:00`).
