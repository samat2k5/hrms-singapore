# Integrating Performance Credit Viewing and Editing

The user asked where to check "Performance Credit" totals. Currently, these are stored in the database and processed by the payroll engine, but they are not visible in the daily/monthly Attendance grid.

## Proposed Changes

### [Attendance Page]

#### [MODIFY] [Attendance.jsx](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/client/src/pages/Attendance.jsx)
- Add a new "Perf. Credit" column to the `matrixData` table.
- Implement an input field in each row for `performance_credit`.
- Ensure the `performance_credit` value is included when loading and saving the matrix data.

### [Backend Attendance Route]

#### [MODIFY] [attendance.js](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/server/routes/attendance.js)
- Update the POST `/monthly` endpoint to handle the `performance_credit` field in the records array, ensuring it's updated in the `timesheets` table.

## Verification Plan

### Manual Verification
- Navigate to the **Attendance** page.
- Select an employee and load their monthly matrix.
- Verify that a new "Perf. Credit" column is visible.
- Enter a value (e.g., `1.0`) into the field for a specific day.
- Click "Save Changes".
- Reload the matrix and verify the value persists.
- (Optional) Run payroll for that month and verify the credit is reflected in the "Perf. Allow ($)" column on the Payroll page.
