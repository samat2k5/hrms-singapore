# Task: Brand application with ezyhr-logo.png

- [x] Research and identify branding locations
- [x] Create implementation plan
- [x] Implement branding updates
    - [x] Update index.html (favicon and title)
    - [x] Update Sidebar/Navbar (verified in Layout.jsx)
    - [x] Update Login page (verified in Login.jsx)
    - [x] Update Payslip UI and PDF
    - [x] Verify Dashboard (branding from Layout)
- [x] Verify branding changes
- [x] Resize branding logos for better visibility (Round 1)
- [x] Increase logo sizes even further (Round 2)
- [x] Final Aggressive Branding & Tagline (Round 3)
- [x] Final Size & Alignment Refinement (Round 4)
- [x] Final Spacing Refinement (Round 5)
- [x] Re-apply cropped logo from root to public directory
- [x] Reduce logo sizes by 40% (Round 6)
- [x] Update Default Credentials
- [x] SPR Graduated CPF Rates Implementation
- [x] Nationality & Language Updates
- [x] MOM Payroll Formulations
    - [x] Logic to calculate working days in a month (excluding PH and Rest Days)
    - [x] Update payroll-engine.js to use dynamic daily rate
    - [x] Update payroll.js route to provide context (PH, Rest Days)
    - [x] Update UI to ensure work-week settings are clear
    - [x] Verify unpaid leave deduction for a specific month
- [x] MOM & Employment Act Compliance
    - [x] Update CPF Ordinary Wage Ceiling to $8,000 (Jan 2026)
    - [x] Implement Gross Rate of Pay formulation for leave/deductions
    - [x] Add check for 72-hour monthly OT limit
    - [x] Implement 50% deduction cap logic
    - [x] Update leave entitlements (Paternity, Shared Parental)
    - [x] Verify KETs against MOM requirements
- [x] MOM Rate Calculations
    - [x] Add `working_hours_per_week` field (default 44)
    - [x] Implement UI auto-calculation for Daily/Hourly Basic Rates
    - [x] Implement UI auto-calculation for 1.5x and 2.0x OT Rates
    - [x] Update payroll route to use stored `working_hours_per_week`
    - [x] Migration to add `working_hours_per_week` column
- [x] MOM Public Holiday Compliance
    - [x] Update payroll-engine to calculate Extra PH Pay
    - [x] Update payroll route to detect PH on Off-Days
    - [x] Integrate Timesheet detection for "Worked on PH"
    - [x] Implement toggle/logic for "Leave Credit" vs "Pay in Lieu" for Off-Day PH
- [x] IRAS Compliance 2026

## Statutory Board Compliance 2026 (CPF, SHG, SDL)

- [x] Update CPF Engine for 2026 Rates & OW Ceiling (S$8,000)
- [x] Update SINDA 2026 Contribution Rates
- [x] Refactor Engines for Multi-Year Support (2025 vs 2026)
- [x] Verify Statutory Calculations via Script
- [x] End-to-End Payroll Verification in UI

## Payroll GIRO Transmission Compliance

- [x] Create [giro-engine.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/giro-engine.js) with DBS, OCBC, UOB, and APS formats
- [x] Update Payroll route for multi-format GIRO export
- [x] Add GIRO Format Selector to Reports UI
- [x] Verify GIRO file structures via script

## Advanced Site Matrix Configuration

- [x] Add OT Meal Breaks and Lateness/Early-Exit penalties to DB schema
- [x] Update Sites API to support new matrix fields
- [x] Implement new configuration inputs in Sites UI
- [x] Verify attendance logic handles new thresholds
- [x] Implement configurable Penalty Blocks (e.g., 15m, 1h)
    - [x] Add penalty block columns to `site_working_hours`
    - [x] Update Sites UI with Penalty Block settings
    - [x] Update [attendance.js](file:///c:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/verify-attendance.js) to apply rounding logic
    - [x] Update [payroll-engine.js](file:///C:/Users/mathi/Desktop/AntiGravity%20Demos/HRMS%20Singapore/server/engine/payroll-engine.js) if necessary (though rounding should happen at source)
    - [x] Align `iras_forms` schema and seed Appendices tables
    - [x] Implement Benefits-in-Kind (A8A) & Share Options (A8B) management
    - [x] Implement AIS-API 2.0 JSON Generator
    - [x] Implement Itemized IR8A/A8A/A8B PDF Export
    - [x] Update Report UI for IRAS management
