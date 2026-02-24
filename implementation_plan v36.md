# Payroll GIRO Transmission Support

Implement compliant bank-ready GIRO files for major Singapore banks (DBS, OCBC, UOB) and the standard Interbank GIRO (APS) format.

## Proposed Changes

### Payroll Engines

#### [NEW] [giro-engine.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/giro-engine.js)
- Implement a modular engine to generate GIRO files.
- Support formats:
    - **DBS UFF (CSV)**: Standard DBS IDEAL format.
    - **OCBC GIRO-FAST (TXT)**: Fixed-width format for OCBC Velocity.
    - **UOB GIRO-FAST (TXT)**: Fixed-width format for UOB Infinity.
    - **Standard APS (TXT)**: 140-character fixed-width Interbank GIRO format.

### Payroll Routes

#### [MODIFY] [payroll.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/payroll.js)
- Update `/api/payroll/export-giro/:runId` to accept a `format` query parameter.
- Integration with [giro-engine.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/giro-engine.js) to return the correctly formatted file and content-type.

### Frontend Updates

#### [MODIFY] [Reports.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Reports.jsx)
- Add a dropdown to select the Bank Format when exporting GIRO.
- Update `handleExportGiro` to pass the selected format.

## Verification Plan

### Automated Tests
- Create `verify-giro-formats.js` to generate and inspect:
    - A DBS UFF CSV file.
    - A Standard APS 140-character fixed-width file.
    - Verify field lengths and headers.

### Manual Verification
- Test exporting different formats from the Reports page.
- Open the exported files to ensure they match the structural specifications (CSV headers, record counts, fixed-width positions).

---

# Advanced Site Matrix Configuration

Extend the Site Matrix to support granular attendance rules for OT meal breaks and disciplinary penalties.

## Proposed Changes

### Database

#### [MODIFY] [init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js)
- Add columns to `site_working_hours`:
    - `ot_meal_start_time`, `ot_meal_end_time`: Deductible break time during OT periods.
    - `late_arrival_threshold_mins`: Grace period before lateness penalty kicks in.
    - `early_departure_threshold_mins`: Grace period before early checkout penalty.

### Backend Routes

#### [MODIFY] [sites.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/sites.js)
- Update batch save logic to persist the new fields.

### Frontend UI

#### [MODIFY] [Sites.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Sites.jsx)
- Add new columns to the "Modify Matrix" grid.
- Use descriptive tooltips for each new threshold.

## Verification Plan

### Manual Verification
- Save and reload site matrix configurations.
- Verify that values persist in the database.

---

# Attendance Penalty & Deduction Logic

Implement backend logic to calculate and deduct salary based on lateness and early checkout thresholds defined in the Site Matrix.

## Proposed Changes

### Database

#### [MODIFY] [init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js)
- Add columns to `timesheets`:
    - `late_mins`: Minutes arrived after shift start (if threshold exceeded).
    - `early_out_mins`: Minutes left before shift end (if threshold exceeded).

### Backend Engines

#### [MODIFY] [attendance.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/attendance.js)
- Update import logic to fetch `late_arrival_threshold_mins` and `early_departure_threshold_mins` from the site config.
- Calculate `late_mins` if `actual_in > scheduled_start + threshold`.
- Calculate `early_out_mins` if `actual_out < scheduled_end - threshold`.

#### [MODIFY] [payroll-engine.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/payroll-engine.js)
- Accept `lateMins` and `earlyOutMins` as options.
- Calculate hourly basic rate: `Daily Rate / 8`.
- Apply deduction: [((lateMins + earlyOutMins) / 60) * Hourly Rate](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Payslip.jsx#409-422).
- Return `attendance_deduction` in the payslip data.

### Frontend UI

#### [MODIFY] [Payroll.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Payroll.jsx)
- Display attendance penalties in the payslip preview/breakdown.

## Verification Plan

### Automated Tests
- Create a test script to upload an attendance file where an employee is 20 mins late (with a 15 min threshold).
- Verify that `late_mins` is recorded as 20.
- Run payroll and verify the deduction amount.

---

# Configurable Penalty Blocks

Support "rounding up" attendance penalties to the nearest block (e.g., 15m, 30m, 1h) as per employer policy.

## Proposed Changes

### Database

#### [MODIFY] [init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js)
- Add columns to `site_working_hours`:
    - `late_arrival_penalty_block_mins`: The interval to round up for lateness (e.g., 15).
    - `early_departure_penalty_block_mins`: The interval to round up for early exit (e.g., 15).

### Backend Routes

#### [MODIFY] [sites.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/sites.js)
- Update batch save to handle block minutes.

#### [MODIFY] [attendance.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/attendance.js)
- Update calculation: `final_late_mins = ceil(actual_late / block) * block`.

### Frontend UI

#### [MODIFY] [Sites.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Sites.jsx)
- Add "Block (mins)" columns to the Site Matrix.

## Verification Plan

### Automated Tests
- Setup a 15 min penalty block.
- Simulate 1 min late. Verify `late_mins` is recorded as 15.
- Simulate 16 mins late. Verify `late_mins` is recorded as 30.

---

# Performance Hour Credit System

A system to reward performance based on daily "credits" (hours) imported from attendance files. These credits are accumulated monthly and rewarded at a configurable multiplier.

## Proposed Changes

### Database

#### [MODIFY] [init.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/db/init.js)
- Add `performance_credit` REAL DEFAULT 0 column to `timesheets`.
- Add `performance_allowance` REAL DEFAULT 0 column to `payslips`.
- Add `performance_multiplier` REAL DEFAULT 1.0 column to `site_working_hours`.

### Backend Routes

#### [MODIFY] [attendance.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/attendance.js)
- Identify "Performance Credit" column in the Excel header.
- Parse and save the value to `timesheets.performance_credit`.

#### [MODIFY] [payroll.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/routes/payroll.js)
- Sum `performance_credit` for the month from `timesheets`.
- Fetch the `performance_multiplier` from the relevant site config.
- Pass these values to the payroll engine.

#### [MODIFY] [payroll-engine.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/payroll-engine.js)
- Add `performanceCredits` and `performanceMultiplier` to options.
- Calculate `performanceAllowance = performanceCredits * hourlyRate * performanceMultiplier`.
- Include `performance_allowance` in the returned object.

### Frontend UI

#### [MODIFY] [Sites.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Sites.jsx)
- Add a "Perf. Multiplier" field to the Site Matrix settings.

#### [MODIFY] [Payroll.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Payroll.jsx)
- Show "Perf. Allowance" in the payroll summary/results table.

#### [MODIFY] [Payslip.jsx](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/client/src/pages/Payslip.jsx)
- Add an itemized row for "Performance Allowance" in the Earnings section.

## Verification Plan

### Automated Tests
- Create `verify-performance-credit.js`:
    - Setup a site with 1.5x Performance Multiplier.
    - Import attendance with 2 hours of performance credit on one day.
    - Process payroll and verify: `Allowance = 2 * HourlyRate * 1.5`.

### Manual Verification
- Upload an Excel file containing a "Performance Credit" column.
- Check the Payroll results to ensure the accumulation and calculation are correct.
- Verify the payslip display.
