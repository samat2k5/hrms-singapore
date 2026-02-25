# Attendance UI Improvements & Multi-Entity Support

I have successfully updated the **Attendance** module to support robust multi-entity management and manual overrides.

## Key Changes

### 1. Multi-Entity Selection
The **Attendance** page now includes a dedicated **Entity Selector** in the manual override section. This allows Admins and HR users with cross-entity permissions to view and edit attendance records for any authorized company.

### 2. Prominent Date Filtering
The **Year** and **Month** selectors have been grouped with the Entity and Employee selectors to provide a clear, unified filtering experience.

### 3. Dynamic Data Loading
- Switching the **Entity** automatically refreshes the **Employee** list to show only staff belonging to that entity.
- Selecting an employee then loads their specific monthly grid for the chosen month and year.

### 4. Robust Backend & API
- **API Service**: Extended to support explicit `entityId` parameters.
- **Backend Routes**: Updated `/monthly` and `/employees` routes to respect the filtered entity and enforce strict authorization checks.

## Verification

The following was verified:
- **Entity Switching**: Changing the entity correctly updates the employee dropdown.
- **Data Integrity**: Manual overrides (Scenario B) are saved correctly to the corresponding entity's records in the `timesheets` database table.
- **Authorization**: Non-Admin users without cross-entity permissions are correctly restricted from accessing other entities.

You can now easily manage, edit, or erase any attendance records across all your organized entities!
