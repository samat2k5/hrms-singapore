### [Detailed Hours Tracking]

The user requested to include "normal hrs / 1.5x OT hrs / 2x OT hrs" in the Attendance grid.

#### [MODIFY] [init.js](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/server/db/init.js)
- Add a migration to add `normal_hours` column to `timesheets`.

#### [MODIFY] [attendance.js](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/server/routes/attendance.js)
- Update GET `/monthly` to return `normal_hours`, `ot_1_5_hours`, `ot_2_0_hours`, and `ph_hours`.
- Update POST `/monthly` to save these fields.
- Add GET `/holidays` (or use existing) to fetch public holidays for the grid highlight.

### [Attendance UI UX Enhancements]

Improving grid visibility and space management.

#### [MODIFY] [Attendance.jsx](file:///c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/client/src/pages/Attendance.jsx)
- Move "Batch Import" into a collapsible panel (Accordion) above the grid.
- Expand "Monthly Grid Override" to full width (`w-full` instead of `lg:col-span-3`).
- Add weekend highlighting (Sat/Sun) to rows.
- Style the "Totals" row for higher visual distinction.
- Improve input field clarity and spacing for hour columns.
- [x] Sticky headers and filter bar positioning
- [ ] Refine "Monthly Grid Override" layout:
    - Move section title to its own row
    - Align all filters (Employee, Year, Month) and "Apply Monthly Matrix" button into a single row below the title
- [ ] Fix dropdown menu styling for dark mode:
    - Update background color to match the theme (e.g., `bg-slate-900`)
    - Ensure text color is clear and distinct
    - Standardize padding and borders for a premium feel
- [ ] Fix "floating" grid header:
    - Adjust `top` offset of the table header to match the action bar height (76px)
    - Ensure z-index layering is correct (Action Bar > Table Header)
- [ ] Update date display format:
    - Change grid date display from `YYYY-MM-DD` to `DD-MM-YYYY` in [Attendance.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Attendance.jsx)
- [ ] Implement Public Holiday (PH) support:
    - Add `ph_hours` column to `timesheets` database table.
    - Fetch and display a "PH Hrs" column in the attendance grid.
    - Highlight rows in the grid that correspond to Public Holidays (e.g., using a distinct amber background).
    - Update totals row to include PH hours.

## Verification Plan

### Manual Verification
- Navigate to the **Attendance** page.
- Select an employee and load their monthly matrix.
- Verify that a new "Perf. Credit" column is visible.
- Enter a value (e.g., `1.0`) into the field for a specific day.
- Click "Save Changes".
- Reload the matrix and verify the value persists.
- (Optional) Run payroll for that month and verify the credit is reflected in the "Perf. Allow ($)" column on the Payroll page.
