# Site-Wise Working Hours Master

## Goal Description
The objective is to create a dynamic master configuration module where HR can define site-wise continuous working hours, break timings, and Overtime thresholds. Currently, payroll attendance is hard-coded to standard hours (e.g., OT past 17:30). The system must now adapt dynamically to rules parsed from the provided `Memorandum (SL-TBY-SCM-2023-006) - NEW WORKING HOURS wef 1st Feb 2024.pdf`.

According to the memo, the new Seatrium Yard hours dictate:
**Day Shift (44hrs/week):**
- Mon-Thurs: 8.00am - 5.15pm (Meal: 12.00pm-1.00pm). OT: 5.15pm - 6.45pm
- Fri: 8.00am - 4.30pm (Meal: 12.00pm-1.00pm). OT: 4.30pm - 6.30pm
- Sat: 8.00am - 11.30am (Meal: 11.30am-12.30pm). OT: 12.30pm onwards
- Sun: OT only, 8.00am - 5.15pm

**Night Shift (40hrs + 5hrs compulsory OT):**
- Mon-Fri: 7.00pm - 4.00am (Meal: 11.00pm - 12.00am). OT: 4.00am - 5.00am

## Proposed Changes

### Database Module
#### [MODIFY] server/db/migrate-sites.js
- `customers` table: `id`, `entity_id`, `name`, `description`.
- `sites` table: `id`, `customer_id`, `name`, `description`.
- `site_working_hours` table: `id`, `site_id`, `shift_type` (Day/Night), `day_of_week` (Mon, Tue, etc.), `start_time`, `end_time`, `meal_start`, `meal_end`, `ot_start`.
- `employees` table: Add `site_id` (INTEGER NULL).

### Backend Module
#### [NEW] server/routes/customers.js
- Standard CRUD operations for building the customer portfolio.

#### [NEW] server/routes/sites.js
- Standard CRUD operations to manage Sites mapped beneath specific Customers and their associated `site_working_hours`.

#### [MODIFY] server/routes/attendance.js
- Refactor the Excel `/import` logic. Instead of hard-coding OT as `17:30`, the API must:
  1. Determine the employee's assigned `site_id` and declared `shift_type` (from Excel or employee record).
  2. Parse the **day of the week** for the specific date (e.g., Friday vs Monday).
  3. Fetch the exact `ot_start` time explicitly mapped for that precise Day in `site_working_hours` (e.g., 4:30pm on Fridays vs 5:15pm on Mondays).
  4. Precisely calculate the `ot_hours` subtracting meal times where applicable.

#### [MODIFY] server/routes/employees.js
- Update the API to map and retrieve an employee's assigned `site_id`.

### Frontend Module
#### [NEW] client/src/pages/Customers.jsx
- A master page to build the customer profiles.

#### [NEW] client/src/pages/Sites.jsx
- A master dashboard to assign physical sites directly to parent Customers and construct the full 7-day schedule matrix for Day & Night shifts strictly enforcing start times, meal times, and OT boundaries.

#### [MODIFY] client/src/pages/Employees.jsx
- Add a dropdown for the assigned site.

## Verification Plan
### Automated Tests
- Check if inserting a daily timesheet dynamically calculates 1.5x OT only past the correctly parameterized `ot_start` block.

### Manual Verification
- Render the `Sites.jsx` grid. Set Monday-Thursday to OT=17:15, and Friday to OT=16:30.
- Upload an Excel attendance file and verify that an employee tapping out at 18:00 on Friday correctly registers 1.5 hours of OT, while tapping out at 18:00 on Monday only registers 0.75 hours of OT.
