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

## Saturday/Sunday OT & Payroll Refinement
Aligning calculations with specific company rules and fixing payroll missing data.

### [MODIFY] [client/src/pages/Attendance.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Attendance.jsx)
- **Align OT Boundaries**: Set `shiftEndMins` and `otStartMins` both to 16:30 (990 mins) instead of 17:00/17:30.
- **Saturday Logic**: Detect `dayOfWeek === 6`. Set `normal_hours` for the first 4.0 hours, then move the remainder to `ot_1_5_hours`.
- **Sunday Logic**: Detect `dayOfWeek === 0`. Categorize ALL hours as `ot_2_0_hours` and set `normal_hours` to 0.

### [MODIFY] [server/routes/attendance.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/attendance.js)
- **Update Import Logic**: Reflect the 16:30 OT boundary and the Saturday (4h basic, then 1.5x) / Sunday (all 2.0x) rules.
- **Normalize Shifts**: Update the `shift_settings` in the database to match 16:30 end/start if not already set.

### [MODIFY] [server/routes/payroll.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/payroll.js)
- **Fix Aggregation**: Ensure `timesheets` aggregation correctly filters by `entity_id` and has no date format mismatches.
- **Verify Sums**: Add logging to debug why `ot_hours` and `performance_credit` are returning 0 for Jan 2026.

### [MODIFY] [server/engine/payroll-engine.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/payroll-engine.js)
- **Ensure Calculation**: Verify that `performanceAllowance` and various OT pays are correctly multiplied by the hourly rate and added to `gross_pay`.

## Verification Plan
1. Enter 08:30 to 18:00 on a Saturday. Verify Grid shows 4.0 Normal and 5.5 OT 1.5x (assuming total 9.5).
2. Enter 08:30 to 17:00 on a Sunday. Verify Grid shows 0 Normal and 8.5 OT 2.0x.
3. Run Payroll for Jan 2026 and verify OT Pay and Performance Allowance are non-zero.
