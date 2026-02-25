# Improving Monthly Grid Override UI and Logic

The goal is to add an employee filter for easier navigation and address the issue of "auto-filled" basic hours in the Monthly Grid Override.

## Proposed Changes

### Frontend

#### [MODIFY] [Attendance.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Attendance.jsx)

- **Employee Filter**:
    - Add a new state `searchTerm` for filtering employees.
    - Add a text input above the employee dropdown to filter the list by Name or Employee ID.
    - Use a filtered list in the `<select>` component.

- **Monthly Grid - Basic Hours Investigation**:
    - Add explicit checks to ensure that placeholders are not confusing the user.
    - If the user confirms that hours are indeed *filled* (not just placeholders), I will investigate the backend data further.
    - Ensure `ot_hours` and other fields are strictly initialized to empty/zero as intended.

## Verification Plan

### Manual Verification
- Verify the employee dropdown correctly filters when typing in the new search box.
- Check the Monthly Grid Override for a "fresh" employee and confirm that cells are empty (showing only placeholders in gray) before clicking "Apply Standard Hours".
