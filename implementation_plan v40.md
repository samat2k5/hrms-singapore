# Multi-Entity Attendance Batch Import

Enhance the attendance import system to support single-file uploads containing employees from multiple entities. This allows administrators to process global timesheets in one go.

## User Review Required

> [!IMPORTANT]
> This change enables **both Admin and non-Admin users** to perform Multi-Entity Attendance Imports. Access is controlled by:
> 1. A global permission `attendance:import:cross-entity` which must be present in the user's assigned role.
> 2. The user's specific entity authorizations (they can only import for entities they are linked to in `user_entity_roles`).

## Proposed Changes

### Database

#### [MODIFY] [init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js)
- Update default `Admin` and `HR` roles to include the `['attendance:import:cross-entity']` permission in the `user_roles` table for easy testing, while allowing granular control later.

### Backend

#### [MODIFY] [attendance.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/attendance.js)

- Update `router.post('/import')` to:
    - Verify if the user's current role has the `attendance:import:cross-entity` permission.
    - Fetch all `entity_ids` where the current user has a valid role (not just `Admin`).
    - Fetch `employees` and `site_working_hours` for all authorized entities.
    - In the row processing loop, resolve the `entity_id` and ensure the user is authorized for that specific entity.

### Frontend

- No changes required to [Attendance.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Attendance.jsx) as the backend will now automatically resolve entities based on the file content.

## Verification Plan

### Automated Tests
- Create a diagnostic script to:
    - Simulate an attendance import with a file containing employees from Entity 1 and Entity 2.
    - Verify that timesheet records are correctly created for both entities in the database.
- Verify that an unauthorized user (non-admin or restricted to one entity) cannot import for other entities.

### Manual Verification
- Upload a multi-entity Excel file in the Attendance UI as a System Administrator.
- Verify that the "Import Results" correctly count processed rows across different companies.
- Switch entities in the UI and confirm that the monthly grid reflects the newly imported data for each company.
