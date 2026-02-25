# Walkthrough: Payroll & Attendance Fixes

I have resolved the issues regarding Attendance loading, Overtime (OT) pay calculations, and the Performance Allowance reward logic.

## Changes Made

### 1. Attendance Data Loading
- **Issue**: Selecting an employee in the "Monthly Grid Override" section resulted in an empty grid, even after a successful sync/import.
- **Fix**: The dropdown menu was using the string `employee_id` (e.g., `EMP001`) as its value. The backend query correctly expects the integer database [id](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/services/api.js#187-201). I updated the frontend to pass the numeric ID, ensuring imported records are correctly retrieved.

### 2. Precise OT Pay Calculation
- **Issue**: OT pay was zero or used default working hours, ignoring site-specific shift configurations.
- **Fix**: 
  - Updated the payroll route to fetch `shift_settings`.
  - The system now identifies each employee's primary shift for the period.
  - It calculates the precise "Hours per Day" by subtracting meal breaks (Lunch, Dinner, Midnight) defined in the master shift settings.
  - This ensures the MOM-compliant hourly rate is calculated using the actual shift duration.

### 3. Performance Allowance Reward
- **Issue**: Performance credits were showing in payroll but not contributing to monetary pay, and the multiplier was previously at the site level.
- **Fix**:
  - Added a `performance_multiplier` column to the `entities` table so rewards are controlled globally for the company.
  - Reinstated the performance reward as a monetary benefit in the gross pay calculation.
  - Updated the payroll route to fetch the entity-level multiplier and pass it to the engine.

## Verification Results

### Database Migrations
Server logs confirmed the successful addition of the `performance_multiplier` column to existing entities:
```
[DB] Migrating entities: Adding performance_multiplier...
📦 Database initialized
```

### Payroll & Attendance
- **Attendance**: The grid now correctly loads records for "January 2026" when an employee is selected.
- **Overtime**: OT pay is now calculated using the actual working hours from the shift (e.g., 8.0h for a standard 8am-5pm shift with 1h lunch).
- **Performance**: Allowance is calculated as `Credits * Hourly Basic Rate * Entity Multiplier`.

> [!IMPORTANT]
> To apply these changes to existing Jan 2026 payroll data, please **void and re-run** the payroll for that period.
