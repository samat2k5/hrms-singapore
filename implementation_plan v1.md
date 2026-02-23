# Singapore MOM/IRAS/CPF Compliant Payroll System

A full-stack payroll application with React 19 frontend and Express/SQLite backend, fully compliant with Singapore MOM, IRAS, and CPF regulations. Includes Employee Management, Key Employment Terms (KETs), Leave Management, Payroll Processing, Payslip Generation, and Compliance Reports.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6, Tailwind CSS 3.4 |
| Charts | Chart.js + react-chartjs-2 |
| PDF | jsPDF + jspdf-autotable |
| Notifications | react-hot-toast |
| Routing | react-router-dom 7 |
| Backend | Node.js + Express 4 |
| Database | sql.js (SQLite in-memory + file persist) |
| Auth | bcryptjs + jsonwebtoken (JWT) |
| File Upload | multer + xlsx |

---

## Project Structure

```
HRMS Singapore/
├── package.json                # Root workspace
├── server/
│   ├── package.json
│   ├── index.js                # Express entry point
│   ├── db/
│   │   ├── init.js             # sql.js setup + schema creation
│   │   └── hrms.sqlite         # Persisted database file
│   ├── middleware/
│   │   └── auth.js             # JWT verification middleware
│   ├── routes/
│   │   ├── auth.js             # Login / Register
│   │   ├── employees.js        # Employee CRUD
│   │   ├── kets.js             # Key Employment Terms
│   │   ├── leave.js            # Leave management
│   │   ├── payroll.js          # Payroll runs & payslips
│   │   └── reports.js          # Compliance reports
│   └── engine/
│       ├── cpf-engine.js       # CPF calculation logic
│       ├── tax-engine.js       # IRAS tax estimation
│       ├── sdl-engine.js       # SDL calculation
│       ├── shg-engine.js       # SHG deduction logic
│       └── payroll-engine.js   # Master payroll orchestrator
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx             # Router + Layout
│       ├── index.css           # Tailwind + glassmorphism theme
│       ├── context/
│       │   └── AuthContext.jsx  # JWT auth state
│       ├── components/
│       │   ├── Layout.jsx       # Sidebar + topbar shell
│       │   ├── ProtectedRoute.jsx
│       │   └── ui/              # Reusable UI components
│       │       ├── StatCard.jsx
│       │       ├── Modal.jsx
│       │       ├── DataTable.jsx
│       │       └── StatusBadge.jsx
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx
│       │   ├── Employees.jsx
│       │   ├── EmployeeKETs.jsx
│       │   ├── Leave.jsx
│       │   ├── Payroll.jsx
│       │   ├── Payslip.jsx
│       │   └── Reports.jsx
│       ├── services/
│       │   └── api.js          # Axios/fetch wrapper with JWT
│       └── utils/
│           ├── formatters.js   # Currency, date helpers
│           └── pdf-export.js   # Payslip PDF generation
```

---

## Database Schema

### `users` — Admin accounts
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| username | TEXT UNIQUE | Login name |
| password_hash | TEXT | bcrypt hashed |
| full_name | TEXT | Display name |
| created_at | DATETIME | Default now |

### `employees` — Employee records
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| employee_id | TEXT UNIQUE | e.g. EMP001 |
| full_name | TEXT | |
| date_of_birth | DATE | For CPF age band |
| nationality | TEXT | Citizen / PR / Foreigner |
| tax_residency | TEXT | Resident / Non-Resident |
| race | TEXT | Chinese / Indian / Malay / Eurasian / Other |
| designation | TEXT | Job title |
| department | TEXT | |
| date_joined | DATE | |
| basic_salary | REAL | Monthly basic |
| transport_allowance | REAL | Fixed allowance |
| meal_allowance | REAL | Fixed allowance |
| other_allowance | REAL | |
| bank_name | TEXT | |
| bank_account | TEXT | |
| cpf_applicable | INTEGER | 1 = yes (Citizens/PR) |
| status | TEXT | Active / Inactive |
| created_at | DATETIME | |

### `employee_kets` — MOM Key Employment Terms
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| employee_id | INTEGER FK | References employees |
| job_title | TEXT | Main duties & responsibilities |
| employment_start_date | DATE | |
| employment_type | TEXT | Permanent / Contract / Part-time |
| contract_duration | TEXT | If fixed-term, e.g. "2 years" |
| working_hours_per_day | REAL | e.g. 8.0 |
| working_days_per_week | INTEGER | e.g. 5 |
| rest_day | TEXT | e.g. "Sunday" |
| salary_period | TEXT | Monthly / Weekly / Daily |
| basic_salary | REAL | |
| fixed_allowances | TEXT | JSON: transport, meal, etc. |
| fixed_deductions | TEXT | JSON: e.g. accommodation |
| overtime_rate | REAL | Per hour rate |
| overtime_payment_period | TEXT | If different from salary period |
| bonus_structure | TEXT | Description of bonus/incentive |
| annual_leave_days | INTEGER | Min 7 per MOM |
| sick_leave_days | INTEGER | Outpatient (14 days) |
| hospitalization_days | INTEGER | 60 days |
| maternity_weeks | INTEGER | 16 weeks |
| paternity_weeks | INTEGER | 2 weeks |
| childcare_days | INTEGER | |
| medical_benefits | TEXT | Insurance, dental, etc. |
| probation_months | INTEGER | e.g. 3 or 6 |
| notice_period | TEXT | e.g. "1 month" |
| place_of_work | TEXT | Optional |
| issued_date | DATE | Must be within 14 days of start |
| created_at | DATETIME | |

### `leave_types` — Leave configuration
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| name | TEXT | Annual / Medical / Hospitalization etc. |
| default_days | INTEGER | Default entitlement |

### `leave_balances` — Per employee per year
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| employee_id | INTEGER FK | |
| leave_type_id | INTEGER FK | |
| year | INTEGER | |
| entitled | REAL | |
| taken | REAL | |
| balance | REAL | |

### `leave_requests` — Leave applications
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| employee_id | INTEGER FK | |
| leave_type_id | INTEGER FK | |
| start_date | DATE | |
| end_date | DATE | |
| days | REAL | |
| reason | TEXT | |
| status | TEXT | Pending / Approved / Rejected |
| created_at | DATETIME | |

### `payroll_runs` — Monthly payroll batches
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| period_year | INTEGER | |
| period_month | INTEGER | |
| run_date | DATE | |
| total_gross | REAL | |
| total_cpf_employee | REAL | |
| total_cpf_employer | REAL | |
| total_sdl | REAL | |
| total_shg | REAL | |
| total_net | REAL | |
| status | TEXT | Draft / Finalized |

### `payslips` — Individual payslip records
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| payroll_run_id | INTEGER FK | |
| employee_id | INTEGER FK | |
| basic_salary | REAL | |
| total_allowances | REAL | |
| overtime_pay | REAL | |
| bonus | REAL | |
| gross_pay | REAL | |
| cpf_employee | REAL | |
| cpf_employer | REAL | |
| cpf_oa | REAL | OA allocation |
| cpf_sa | REAL | SA allocation |
| cpf_ma | REAL | MA allocation |
| sdl | REAL | |
| shg_deduction | REAL | |
| shg_fund | TEXT | CDAC/SINDA/MBMF/ECF |
| other_deductions | REAL | |
| net_pay | REAL | |

---

## Compliance Engines (Server-side)

### CPF Engine (2026 Rates)
- 5 age bands with employer/employee rates
- OW ceiling: S$8,000/month, Annual ceiling: S$102,000
- OA/SA/MA allocation by age band
- Rounding to nearest dollar

### IRAS Tax Engine
- YA 2026 progressive brackets (0%→24%) for residents
- Non-resident: higher of 15% flat or progressive rates
- Monthly tax estimate = annual tax / 12

### SDL Engine
- 0.25% of total wages, min S$2, max S$11.25 per employee

### SHG Engine
- Race-based fund determination (CDAC/SINDA/MBMF/ECF)
- Tiered income-based contribution tables
- Only for Citizens/PRs

---

## UI Pages

### Login
- JWT-based auth with glassmorphism login card

### Dashboard
- Stat cards: headcount, total payroll, CPF, SDL (animated counters)
- Bar chart: monthly payroll trend
- Doughnut: cost breakdown (gross, CPF employer, SDL)
- Recent payroll runs table

### Employees
- Searchable data table with status badges
- Add/Edit slide-out modal with full employee fields
- Bulk import via Excel (multer + xlsx)
- Delete with confirmation

### Key Employment Terms (KETs)
- Auto-generated KET document per employee using stored data
- All 17 MOM-mandatory fields displayed in structured card layout
- Editable fields: working hours, rest day, overtime rate, probation, notice period, bonus structure, medical benefits
- "Issue KET" button that sets issued_date and marks compliance
- PDF export of KET document for employee distribution
- Warning badge if KET not issued within 14 days of employment start

### Leave
- Leave balance overview per employee (color-coded bars)
- Apply leave form (date picker, type selector)
- Leave requests list with Approve/Reject actions
- MOM-compliant leave types: Annual (7+ days), Medical (14 days), Hospitalization (60 days), Childcare, Maternity (16 weeks), Paternity (2 weeks)

### Payroll
- Month/year selector → "Run Payroll" button
- Results table with expandable CPF/SDL/SHG breakdown
- Auto-deduct unpaid leave days from gross

### Payslip
- MOM-compliant itemized layout with all required fields
- PDF export via jsPDF + autotable

### Reports
- CPF Monthly Submission summary
- IRAS IR8A Annual summary
- SDL Summary report
- SHG Deductions report
- All exportable to PDF

---

## Design Theme

Dark-mode glassmorphism with Tailwind CSS 3.4:
- Background: deep navy/slate gradient
- Cards: frosted glass (`backdrop-blur-xl`, `bg-white/5`, subtle borders)
- Accent: vibrant cyan/teal gradient for primary actions
- Typography: Inter font
- Micro-animations: hover lifts, counter animations, smooth transitions
- Sidebar: glass sidebar with icon + text nav

---

## Verification Plan

### Dev Server Testing
1. Start backend: `cd server && node index.js`
2. Start frontend: `cd client && npm run dev`
3. Navigate all pages, test CRUD flows

### Calculation Spot Checks
- Employee age 30, salary S$6,000 → CPF employee S$1,200, employer S$1,020
- Salary S$10,000 → CPF on S$8,000 (OW ceiling)
- SDL on S$6,000 → S$11.25 (max cap)
- CDAC for Chinese employee earning S$5,000 → S$2.00

### Compliance Checks
- Payslip contains all MOM-mandatory fields
- Leave entitlements match Employment Act minimums
- KETs contain all 17 MOM-mandatory fields
- KET issued-date warning triggers correctly
