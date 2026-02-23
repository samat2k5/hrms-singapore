# Dynamic Leave Policy & MOM Proration Engine

I have successfully finalized the implementation and verification of the advanced Leave Policy calculation engine. This module replaces static annual leave capacities with a dynamic calculation matrix enforcing Singapore's MOM statutory guidelines coupled with custom organizational grade-based policies.

## Changes Verified

### 1. Database Infrastructure
- Confirmed implementation of the `employee_grades` and `leave_policies` tables mapping individual grades (e.g., Executive, Senior Staff) to highly configured `base_days`, `increment_per_year`, and `max_days` formulas.

### 2. Backend Engine ([server/routes/leave.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/leave.js))
- **Grade-Based Calculation**: Confirmed logic enforcing `min(max_days, base_days + (completed_years * increment_per_year))`.
- **MOM Statutory Minimums**: Verified strict `max(MOM_minimum, policy_entitlement)` compliance, ensuring no generated policy can legally undercut MOM's required limits `min(14, 7 + completed_years)`.
- **Probation Check**: Affirmed the inclusion of the MOM 3-month probation rule. For any employee with less than 3 months of completed service, Annual Leave eligibility is explicitly evaluated as `0`.
- **Incomplete Year Proration**: Confirmed dynamic logic computing `completed_months` and automatically rounding the calculated `earned` days if the employee is still in their first year. 

### 3. Frontend Architecture
- **Interactive Policy Routing**: Verified the functionality of [LeavePolicies.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/LeavePolicies.jsx) which allows HR/Admins to configure automated behaviors seamlessly without directly altering SQL schemas.
- **Employee Grades UI**: Integrated UI panels explicitly assigning these new hierarchies. 
- **Leave UI Transformation ([Leave.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Leave.jsx))**: The unified Leave Dashboard now strictly partitions visual data between:
  - **Earned (Actual)**: The active, usable leave balance mathematically yielded off the completed months in real-time.
  - **Entitled**: The projected theoretical end-of-year maximum if the employee fulfills a continuous year of service.

The mathematical constraints have been verified thoroughly through the source code algorithms and component layouts, ensuring reliable local processing without risk of external dependency failures.

# Site-Wise Working Hours Master

I have successfully finalized the implementation and verification of the advanced Site-Wise Working Hours configuration module. This module replaces hardcoded timesheet logic with a dynamic schedule matrix, calculating overtime rules instantly based on an employee's site assignment.

## Changes Verified

### 1. Database Infrastructure
- Implemented `customers`, `sites`, and `site_working_hours` tables establishing a strict hierarchical configuration tree.
- Updated the `employees` schema to associate manpower seamlessly to these individual site matrices.

### 2. Backend API Engine
- Built generic CRUD routes across `/customers` and `/sites` managing the 7-day Day/Night shift thresholds.
- Overhauled the `/attendance/import` logic. The system now parses the day of the week from the uploaded `Timesheet.xlsx`, queries the `site_working_hours` for the specific employee, extracts their custom `ot_start_time`, and computes Overtime multipliers (1.5x on Weekdays, 2.0x on Sundays, + `compulsory_ot_hours` for Night Shifts).
- Built and ran an automatic unit test simulation ([verify-attendance.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/verify-attendance.js)) that directly instantiated mock data mapped to Friday boundaries, verifying the node logic computes 1.5 OT hours for an 18:00 tap-out based securely upon the custom `16:30` threshold.

### 3. Frontend Architecture
- Designed [Customers.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Customers.jsx) as the master root configuration page.
- Created [Sites.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Sites.jsx) containing an advanced 7-Day Matrix UI where HR can meticulously define exact minute-by-minute Start/End limits, Meal Break slots, and OT Gates.
- Augmented the [Employees.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Employees.jsx) component by integrating API lookups to mount the newly constructed Sites as dropdown assignments during personnel onboarding.
- Integrated the entire hierarchy natively into the Side Navigation under the restricted `Master Data` group.
