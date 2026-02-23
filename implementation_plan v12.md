# Manual Attendance Overrides & Monthly Matrix

## Goal Description
The objective is to allow HR or Administrators to manually override an employee's attendance on a single screen for an entire month, without relying solely on the Excel importer. Additionally, the user requested a "1-click" feature to quickly apply standard Basic Salary Hours. 

This will prevent blockers when dealing with edge-case attendance data, lost tap records, or specific payroll adjustments requiring direct manual intervention.

## Proposed Changes

### Backend Module ([server/routes/attendance.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/attendance.js))
#### [MODIFY] `GET /api/attendance`
- Expand existing GET routes to allow fetching exactly 31 days (a full month) of `timesheets` arrayed individually for one selected `employee_id` to populate the frontend matrix.

#### [NEW] `POST /api/attendance/monthly`
- Build a bulk-save transaction endpoint. 
- It will receive an array of modified daily payloads (e.g. `[{ date: '2024-02-01', in_time: '08:00', out_time: '17:30', ... }]`).
- Using an `ON CONFLICT(entity_id, employee_id, date) DO UPDATE` UPSERT query, it will blast the array into the database securely in one SQL block.

### Frontend Module ([client/src/pages/Attendance.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Attendance.jsx))
#### [MODIFY] [Attendance.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Attendance.jsx)
- Replace or enhance the current simple "History" table with a powerful **Monthly Matrix Panel**.
- **Selectors**: Add Dropdowns filtering by `Year`, `Month`, and [Employee](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Employees.jsx#36-534).
- **The Matrix Panel**: Once an employee is selected, explicitly render all days in the month (e.g., 1st to 31st).
  - Columns will include: `Date`, `Day`, `In Time`, `Out Time`, `Shift`, `OT Hours`, `Remarks`.
  - All standard input boxes will be inline-editable for blazing fast manual overrides.
- **"Apply Basic Pattern" Button**: 
  - A global 1-click button at the top of the grid. When clicked, it will iterate through the loaded array and automatically fill out standard Monday-Friday working blocks (ignoring weekends) directly into the UI state before submission.
- **"Save Month" Button**: 
  - Triggers the bulk POST endpoint to finalize the modifications.

### State & API integration ([client/src/services/api.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/services/api.js))
#### [MODIFY] [api.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/services/api.js)
- Generate `getMonthlyTimesheets(employeeId, year, month)` binding.
- Generate `saveMonthlyTimesheets(employeeId, year, month, records)` binding.

## Verification Plan
### Manual Verification
1. Open the UI, select Month `March 2024`, Select employee `John Doe`.
2. Click "Apply Basic Hours". Observe weekdays automatically populate `08:00` - `17:30` arrays.
3. Manually override Day 5's OT to `3.5` hours.
4. Click Save. 
5. Refresh the page and assert the data persists accurately in the GET fetch.
