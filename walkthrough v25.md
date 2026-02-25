# Walkthrough: Multi-Entity Attendance Import

I have implemented the Multi-Entity Attendance Batch Import feature, allowing authorized users (including both Admins and HR managers) to import records for employees across multiple companies in a single file upload.

## Key Changes

### 1. Permission-Based Access Control
- Added a new granular permission: `attendance:import:cross-entity`.
- By default, the `Admin` and `HR` roles are now initialized with this permission in [db/init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js).
- Access is still strictly partitioned: users can only import for entities they are explicitly authorized to manage in the `user_entity_roles` table.

### 2. Backend Import Engine Enhancements
- Updated [server/routes/attendance.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/attendance.js) to dynamically resolve all entities the user is authorized for.
- Modified the lookup logic for `employees` and `site_working_hours` to pull data from all authorized entities into cached maps.
- Each row in the Excel file now resolves to its specific `entity_id` based on the Employee ID, ensuring data is saved to the correct company's timesheets.
- Added support for `perfcredit` as a recognized header for Performance Credit columns.

## Verification Results

### Automated Diagnostic
I executed a verification script [server/verify-multi-import.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/verify-multi-import.js) which:
- Simulated a single file containing records for employees in different entities.
- Verified that the system correctly identifies all authorized entities for the user.
- Confirmed that the mapping logic can resolve and process records across these boundaries.

```text
--- Starting Multi-Entity Import Verification ---
Authorizations found: 4
Processing Employee 2001 (Test E1) for Entity 1
Processing Employee 2007 (Test E2) for Entity 2
Successfully simulated processing of records across entities.
✅ PASS: Multi-entity resolving logic works.
```

## How to use
1. Log in as an Admin or HR user who has access to multiple entities.
2. Go to the **Attendance** page.
3. Upload an Excel file containing Employee IDs from different companies.
4. The system will automatically partition the records and update the respective attendance logs for each entity.

> [!NOTE]
> No frontend changes were required as the backend now handles the multi-entity resolution transparently based on your role's permissions and entity authorizations.
