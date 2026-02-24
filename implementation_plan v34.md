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
