# Improving Attendance UI with Entity and Date Selection

The user reported that the manual override workflow (Scenario B) is blocked because the Attendance page lacks an Entity selector and clear Date Range selection.

## Proposed Changes

### [Attendance Page]

#### [MODIFY] [Attendance.jsx](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/client/src/pages/Attendance.jsx)
- Add a state variable for `selectedEntityId`.
- Fetch all authorized entities for the user on component mount.
- Add an Entity dropdown to the "Monthly Grid Override" filters row.
- Ensure the `employees` list updates based on the `selectedEntityId`.
- Pass the `selectedEntityId` to the API calls for fetching and saving timesheets if the user has cross-entity permissions.

### [API Service]

#### [MODIFY] [api.js](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/client/src/services/api.js)
- Update [getEmployees](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/services/api.js#53-55) to optionally accept an `entityId`.
- Update [getMonthlyTimesheets](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/services/api.js#66-67) and [saveMonthlyTimesheets](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/services/api.js#67-68) to optionally accept/send an `entityId`.

### [Backend Attendance Route]

#### [MODIFY] [attendance.js](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/server/routes/attendance.js)
- Update GET and POST `/monthly` endpoints to respect the `entityId` from headers or query params, ensuring the user is authorized for that entity.

## Verification Plan

### Manual Verification
- Log in as Admin.
- Navigate to the Attendance page.
- Select a specific Entity from the new dropdown.
- Select a Month and Year.
- Verify that the Employee list updates to show staff from the selected Entity.
- Select an employee and verify the monthly grid loads correctly.
- Save a change and verify it persists in the correct entity's data.
