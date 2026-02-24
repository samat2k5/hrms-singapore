const initSQL = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'hrms.sqlite');

let db = null;

async function getDb() {
  if (db) return db;

  const SQL = await initSQL();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);

    // SELF-HEALING MIGRATION: Ensure MOM columns exist
    try {
      const check = db.exec("PRAGMA table_info(employee_kets)");
      const columns = check[0].values.map(v => v[1]);
      if (!columns.includes('main_duties')) {
        console.log('[DB] Migrating employee_kets for MOM alignment...');
        const migrations = [
          { name: 'main_duties', type: 'TEXT' },
          { name: 'employment_end_date', type: 'DATE' },
          { name: 'working_hours_details', type: 'TEXT' },
          { name: 'break_hours', type: 'TEXT' },
          { name: 'salary_payment_date', type: 'TEXT' },
          { name: 'overtime_payment_date', type: 'TEXT' },
          { name: 'gross_rate_of_pay', type: 'REAL' },
          { name: 'other_salary_components', type: 'TEXT' },
          { name: 'cpf_payable', type: 'BOOLEAN DEFAULT 1' },
          { name: 'probation_start_date', type: 'DATE' },
          { name: 'probation_end_date', type: 'DATE' }
        ];
        for (const col of migrations) {
          try { db.run(`ALTER TABLE employee_kets ADD COLUMN ${col.name} ${col.type}`); } catch (e) { }
        }
        saveDb();
        console.log('[DB] MOM Alignment migration completed');
      }
    } catch (e) { console.error('[DB] Migration check failed:', e.message); }

    // SELF-HEALING MIGRATION: Site Working Hours advanced fields
    try {
      const check = db.exec("PRAGMA table_info(site_working_hours)");
      if (check.length > 0) {
        const columns = check[0].values.map(v => v[1]);
        const migrations = [
          { name: 'ot_meal_start_time', type: 'TEXT' },
          { name: 'ot_meal_end_time', type: 'TEXT' },
          { name: 'late_arrival_threshold_mins', type: 'INTEGER DEFAULT 0' },
          { name: 'early_departure_threshold_mins', type: 'INTEGER DEFAULT 0' },
          { name: 'late_arrival_penalty_block_mins', type: 'INTEGER DEFAULT 0' },
          { name: 'early_departure_penalty_block_mins', type: 'INTEGER DEFAULT 0' },
          { name: 'performance_multiplier', type: 'REAL DEFAULT 1.0' }
        ];
        for (const col of migrations) {
          if (!columns.includes(col.name)) {
            console.log(`[DB] Migrating site_working_hours: Adding ${col.name}...`);
            db.run(`ALTER TABLE site_working_hours ADD COLUMN ${col.name} ${col.type}`);
          }
        }
        saveDb();
      }
    } catch (e) { console.error('[DB] Site matrix migration failed:', e.message); }

    // SELF-HEALING MIGRATION: Timesheets attendance tracking
    try {
      const check = db.exec("PRAGMA table_info(timesheets)");
      if (check.length > 0) {
        const columns = check[0].values.map(v => v[1]);
        const migrations = [
          { name: 'late_mins', type: 'INTEGER DEFAULT 0' },
          { name: 'early_out_mins', type: 'INTEGER DEFAULT 0' },
          { name: 'performance_credit', type: 'REAL DEFAULT 0' }
        ];
        for (const col of migrations) {
          if (!columns.includes(col.name)) {
            console.log(`[DB] Migrating timesheets: Adding ${col.name}...`);
            db.run(`ALTER TABLE timesheets ADD COLUMN ${col.name} ${col.type}`);
          }
        }
        saveDb();
      }
    } catch (e) { console.error('[DB] Timesheets migration failed:', e.message); }

    // SELF-HEALING MIGRATION: Payslips attendance tracking
    try {
      const check = db.exec("PRAGMA table_info(payslips)");
      if (check.length > 0) {
        const columns = check[0].values.map(v => v[1]);
        const migrations = [
          { name: 'late_mins', type: 'INTEGER DEFAULT 0' },
          { name: 'early_out_mins', type: 'INTEGER DEFAULT 0' },
          { name: 'attendance_deduction', type: 'REAL DEFAULT 0' },
          { name: 'performance_allowance', type: 'REAL DEFAULT 0' }
        ];
        for (const col of migrations) {
          if (!columns.includes(col.name)) {
            console.log(`[DB] Migrating payslips: Adding ${col.name}...`);
            db.run(`ALTER TABLE payslips ADD COLUMN ${col.name} ${col.type}`);
          }
        }
        saveDb();
      }
    } catch (e) { console.error('[DB] Payslips migration failed:', e.message); }

  } else {
    db = new SQL.Database();
    createSchema(db);
    seedData(db);
    seedConfigData(db);
    saveDb();
  }

  // Ensure default roles exist
  const rolesCheck = db.exec("SELECT COUNT(*) FROM user_roles");
  if (rolesCheck[0].values[0][0] === 0) {
    db.run(`INSERT INTO user_roles (name, description) VALUES (?, ?)`, ['Admin', 'Full system access']);
    db.run(`INSERT INTO user_roles (name, description) VALUES (?, ?)`, ['HR', 'Human resources and payroll management']);
    saveDb();
  }

  return db;
}

function saveDb() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    console.log(`[DB] Saved to ${DB_PATH} (${buffer.length} bytes)`);
  } catch (err) {
    console.error(`[DB] Failed to save to ${DB_PATH}:`, err.message);
  }
}

function reloadDb() {
  db = null;
  console.log('[DB] Database variable cleared for reload');
}

function createSchema(database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uen TEXT UNIQUE,
      name TEXT NOT NULL,
      address TEXT,
      contact_number TEXT,
      website TEXT,
      email_domains TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS user_entity_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      entity_id INTEGER NOT NULL,
      role TEXT DEFAULT 'HR',
      managed_groups TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (entity_id) REFERENCES entities(id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id),
      UNIQUE(entity_id, name)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS employee_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id),
      UNIQUE(entity_id, name)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS employee_grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id),
      UNIQUE(entity_id, name)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS email_domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER NOT NULL,
      domain TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id),
      UNIQUE(entity_id, domain)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      date DATE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id),
      UNIQUE(entity_id, name, date)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER NOT NULL,
      employee_id TEXT NOT NULL,
      full_name TEXT NOT NULL,
      date_of_birth DATE,
      national_id TEXT,
      nationality TEXT DEFAULT 'Singapore Citizen',
      tax_residency TEXT DEFAULT 'Resident',
      race TEXT,
      designation TEXT,
      department TEXT,
      employee_group TEXT,
      employee_grade TEXT DEFAULT '',
      gender TEXT,
      language TEXT,
      mobile_number TEXT,
      whatsapp_number TEXT,
      email TEXT,
      highest_education TEXT,
      date_joined DATE,
      basic_salary REAL,
      transport_allowance REAL,
      meal_allowance REAL,
      other_allowance REAL,
      custom_allowances TEXT DEFAULT '{}',
      custom_deductions TEXT DEFAULT '{}',
      payment_mode TEXT DEFAULT 'Bank Transfer',
      bank_name TEXT,
      bank_account TEXT,
      cpf_applicable BOOLEAN DEFAULT 1,
      pr_status_start_date DATE,
      cpf_full_rate_agreed BOOLEAN DEFAULT 0,
      working_days_per_week REAL DEFAULT 5.5,
      rest_day TEXT DEFAULT 'Sunday',
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(entity_id) REFERENCES entities(id),
      UNIQUE(entity_id, employee_id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS employee_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      document_type TEXT NOT NULL,
      document_number TEXT NOT NULL,
      issue_date DATE,
      expiry_date DATE,
      file_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS employee_kets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      job_title TEXT,
      employment_start_date DATE,
      employment_type TEXT DEFAULT 'Permanent',
      contract_duration TEXT,
      working_hours_per_day REAL DEFAULT 8,
      working_days_per_week INTEGER DEFAULT 5,
      rest_day TEXT DEFAULT 'Sunday',
      salary_period TEXT DEFAULT 'Monthly',
      basic_salary REAL DEFAULT 0,
      fixed_allowances TEXT DEFAULT '{}',
      fixed_deductions TEXT DEFAULT '{}',
      custom_allowances TEXT DEFAULT '{}',
      custom_deductions TEXT DEFAULT '{}',
      employee_grade TEXT DEFAULT '',
      overtime_rate REAL DEFAULT 0,
      overtime_payment_period TEXT,
      bonus_structure TEXT,
      annual_leave_days INTEGER DEFAULT 7,
      sick_leave_days INTEGER DEFAULT 14,
      hospitalization_days INTEGER DEFAULT 60,
      maternity_weeks INTEGER DEFAULT 16,
      paternity_weeks INTEGER DEFAULT 2,
      childcare_days INTEGER DEFAULT 6,
      medical_benefits TEXT,
      probation_months INTEGER DEFAULT 3,
      notice_period TEXT DEFAULT '1 month',
      place_of_work TEXT,
      main_duties TEXT,
      employment_end_date DATE,
      working_hours_details TEXT,
      break_hours TEXT,
      salary_payment_date TEXT,
      overtime_payment_date TEXT,
      gross_rate_of_pay REAL,
      other_salary_components TEXT,
      cpf_payable BOOLEAN DEFAULT 1,
      probation_start_date DATE,
      probation_end_date DATE,
      issued_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS leave_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      default_days REAL NOT NULL
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS leave_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER NOT NULL,
      employee_grade TEXT NOT NULL,
      leave_type_id INTEGER NOT NULL,
      base_days REAL DEFAULT 0,
      increment_per_year REAL DEFAULT 0,
      max_days REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id),
      FOREIGN KEY (leave_type_id) REFERENCES leave_types(id),
      UNIQUE(entity_id, employee_grade, leave_type_id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS leave_balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      leave_type_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      entitled REAL DEFAULT 0,
      taken REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (leave_type_id) REFERENCES leave_types(id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      leave_type_id INTEGER NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      days REAL NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'Pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (leave_type_id) REFERENCES leave_types(id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS payroll_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER NOT NULL,
      employee_group TEXT NOT NULL,
      period_year INTEGER NOT NULL,
      period_month INTEGER NOT NULL,
      run_date DATE NOT NULL,
      payment_date DATE,
      total_gross REAL DEFAULT 0,
      total_cpf_employee REAL DEFAULT 0,
      total_cpf_employer REAL DEFAULT 0,
      total_sdl REAL DEFAULT 0,
      total_shg REAL DEFAULT 0,
      total_net REAL DEFAULT 0,
      status TEXT DEFAULT 'Draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS payslips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payroll_run_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      employee_name TEXT,
      employee_code TEXT,
      basic_salary REAL DEFAULT 0,
      transport_allowance REAL DEFAULT 0,
      meal_allowance REAL DEFAULT 0,
      other_allowance REAL DEFAULT 0,
      total_allowances REAL DEFAULT 0,
      overtime_hours REAL DEFAULT 0,
      overtime_pay REAL DEFAULT 0,
      ot_1_5_hours REAL DEFAULT 0,
      ot_2_0_hours REAL DEFAULT 0,
      ot_1_5_pay REAL DEFAULT 0,
      ot_2_0_pay REAL DEFAULT 0,
      ph_worked_pay REAL DEFAULT 0,
      ph_off_day_pay REAL DEFAULT 0,
      bonus REAL DEFAULT 0,
      custom_allowances TEXT DEFAULT '{}',
      custom_deductions TEXT DEFAULT '{}',
      payment_mode TEXT DEFAULT 'Bank Transfer',
      gross_pay REAL DEFAULT 0,
      cpf_employee REAL DEFAULT 0,
      cpf_employer REAL DEFAULT 0,
      cpf_oa REAL DEFAULT 0,
      cpf_sa REAL DEFAULT 0,
      cpf_ma REAL DEFAULT 0,
      sdl REAL DEFAULT 0,
      shg_deduction REAL DEFAULT 0,
      shg_fund TEXT,
      other_deductions REAL DEFAULT 0,
      unpaid_leave_days REAL DEFAULT 0,
      unpaid_leave_deduction REAL DEFAULT 0,
      late_mins INTEGER DEFAULT 0,
      early_out_mins INTEGER DEFAULT 0,
      attendance_deduction REAL DEFAULT 0,
      performance_allowance REAL DEFAULT 0,
      net_pay REAL DEFAULT 0,
      compliance_notes TEXT DEFAULT '',
      FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id),
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS user_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      permissions TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS timesheets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      date DATE NOT NULL,
      in_time TEXT,
      out_time TEXT,
      shift TEXT,
      ot_hours REAL DEFAULT 0,
      ot_1_5_hours REAL DEFAULT 0,
      ot_2_0_hours REAL DEFAULT 0,
      remarks TEXT,
      source_file TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(entity_id) REFERENCES entities(id),
      FOREIGN KEY(employee_id) REFERENCES employees(id),
      UNIQUE(entity_id, employee_id, date)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS attendance_remarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      date DATE NOT NULL,
      remark_type TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(entity_id) REFERENCES entities(id),
      FOREIGN KEY(employee_id) REFERENCES employees(id),
      UNIQUE(entity_id, employee_id, date)
    )
  `);

  // IRAS Compliance Tables
  database.run(`
    CREATE TABLE IF NOT EXISTS submission_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT,
      submission_type TEXT NOT NULL,
      file_type TEXT,
      acknowledgment_no TEXT,
      records_count INTEGER DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS iras_forms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      form_type TEXT NOT NULL,
      data_json TEXT NOT NULL,
      status TEXT DEFAULT 'Generated',
      version INTEGER DEFAULT 1,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_locked BOOLEAN DEFAULT 1,
      FOREIGN KEY (entity_id) REFERENCES entities(id),
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS iras_benefits_in_kind (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      value REAL DEFAULT 0,
      period_from DATE,
      period_to DATE,
      is_taxable BOOLEAN DEFAULT 1,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS iras_share_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      plan_type TEXT,
      grant_date DATE,
      exercise_date DATE,
      exercise_price REAL,
      market_value REAL,
      shares_count INTEGER,
      taxable_profit REAL,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
  `);
}

function seedData(database) {
  // Default system user and restricted HR user
  const systemHash = bcrypt.hashSync('manager', 10);
  const hrHash = bcrypt.hashSync('hr123', 10);

  // Entities
  database.run(`INSERT INTO entities (name, uen, address, contact_number, website, email_domains) VALUES (?, ?, ?, ?, ?, ?)`, ['Hypex Pte Ltd', '202012345A', '123 Tech Lane, Singapore', '65432100', 'https://hypex.sg', 'hypex.com.sg, gmail.com, yahoo.com']);
  database.run(`INSERT INTO entities (name, uen, address, contact_number, website, email_domains) VALUES (?, ?, ?, ?, ?, ?)`, ['Samat Global', '202167890B', '456 Global Way, Singapore', '67890011', 'https://samat.com', 'samat.com, gmail.com']);

  // Default User Roles
  database.run(`INSERT INTO user_roles (name, description) VALUES (?, ?)`, ['Admin', 'Full system access']);
  database.run(`INSERT INTO user_roles (name, description) VALUES (?, ?)`, ['HR', 'Human resources and payroll management']);

  database.run(
    `INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?)`,
    ['system', systemHash, 'System Administrator']
  );
  database.run(
    `INSERT INTO user_entity_roles (user_id, entity_id, role, managed_groups) VALUES (?, ?, ?, ?)`,
    [1, 1, 'Admin', '[]']
  );
  database.run(
    `INSERT INTO user_entity_roles (user_id, entity_id, role, managed_groups) VALUES (?, ?, ?, ?)`,
    [1, 2, 'Admin', '[]']
  );

  database.run(
    `INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?)`,
    ['hrmanager', hrHash, 'HR Manager (Ops)']
  );
  database.run(
    `INSERT INTO user_entity_roles (user_id, entity_id, role, managed_groups) VALUES (?, ?, ?, ?)`,
    [2, 1, 'HR', JSON.stringify(['Operations'])]
  );

  // MOM-compliant leave types
  const leaveTypes = [
    ['Annual Leave', 7], // Base annual leave, typically increases by 1 day per year of service
    ['Medical Leave', 14],
    ['Hospitalization Leave', 60],
    ['Childcare Leave', 6],
    ['Maternity Leave', 112],   // 16 weeks = 112 days
    ['Paternity Leave', 24],    // 4 weeks = 24 days
    ['Shared Parental Leave', 60], // 10 weeks = 60 days
    ['Compassionate Leave', 3],
    ['Unpaid Leave', 0]
  ];

  leaveTypes.forEach(([name, days]) => {
    database.run(
      `INSERT INTO leave_types (name, default_days) VALUES (?, ?)`,
      [name, days]
    );
  });

  // Seed sample employees with groups
  const sampleEmployees = [
    [1, 'EMP001', 'John Doe', '1985-06-15', 'S1234567A', 'Singapore Citizen', 'Resident', 'Chinese', 'Software Engineer', 'Technology', 'Executive', '2020-01-01', 5000, 200, 150, 0, 'DBS Bank', '1234567890', 1],
    [1, 'EMP002', 'Jane Smith', '1990-09-20', 'S1234567B', 'SPR', 'Resident', 'Malay', 'UI Designer', 'Technology', 'Executive', '2021-03-15', 4500, 150, 100, 0, 'OCBC Bank', '2345678901', 1],
    [1, 'EMP003', 'Ahmad bin Hassan', '1985-03-10', 'S1112223C', 'Singapore Citizen', 'Resident', 'Malay', 'Operations Manager', 'Operations', 'Operations', '2021-03-20', 8500, 400, 200, 0, 'UOB Bank', '3456789012', 1],
  ];

  sampleEmployees.forEach(emp => {
    database.run(
      `INSERT INTO employees (entity_id, employee_id, full_name, date_of_birth, national_id, nationality, tax_residency, race, designation, department, employee_group, date_joined, basic_salary, transport_allowance, meal_allowance, other_allowance, bank_name, bank_account, cpf_applicable, working_days_per_week, rest_day) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...emp, 5.5, 'Sunday']
    );
  });

  // Seed KETs for sample employees
  const currentYear = new Date().getFullYear();
  sampleEmployees.forEach((emp, idx) => {
    database.run(
      `INSERT INTO employee_kets (employee_id, job_title, employment_start_date, employment_type, working_hours_per_day, working_days_per_week, rest_day, salary_period, basic_salary, fixed_allowances, overtime_rate, annual_leave_days, sick_leave_days, hospitalization_days, probation_months, notice_period, issued_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [idx + 1, emp[8], emp[11], 'Permanent', 8, 5, 'Sunday', 'Monthly', emp[12],
      JSON.stringify({ transport: emp[13], meal: emp[14] }), 0, 14, 14, 60, 3, '1 month', emp[11]]
    );
  });

  // Seed leave balances for current year
  const leaveTypeCount = leaveTypes.length;
  for (let empId = 1; empId <= sampleEmployees.length; empId++) {
    for (let ltId = 1; ltId <= leaveTypeCount; ltId++) {
      const entitled = leaveTypes[ltId - 1][1];
      database.run(
        `INSERT INTO leave_balances (employee_id, leave_type_id, year, entitled, taken, balance) VALUES (?, ?, ?, ?, ?, ?)`,
        [empId, ltId, currentYear, entitled, 0, entitled]
      );
    }
  }

  // Seed sample documents (one valid, one expiring soon)
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  database.run(
    `INSERT INTO employee_documents (employee_id, document_type, document_number, issue_date, expiry_date) VALUES (?, ?, ?, ?, ?)`,
    [1, 'NRIC', 'S9012345A', '2015-05-15', null] // NRIC typically doesn't expire
  );
  database.run(
    `INSERT INTO employee_documents (employee_id, document_type, document_number, issue_date, expiry_date) VALUES (?, ?, ?, ?, ?)`,
    [2, 'Work Pass', 'E12345678', '2023-06-01', thirtyDaysFromNow.toISOString().split('T')[0]] // Expiring soon
  );
}

function seedConfigData(database) {
  // Seed Departments for Entity 1 (Tech)
  ['Technology', 'Finance', 'Operations', 'Human Resources'].forEach(dept => {
    database.run(`INSERT INTO departments (entity_id, name, description) VALUES (?, ?, ?)`, [1, dept, `${dept} Department`]);
  });
  // Seed Departments for Entity 2 (Services)
  ['Advisory', 'Sales', 'Customer Support'].forEach(dept => {
    database.run(`INSERT INTO departments (entity_id, name, description) VALUES (?, ?, ?)`, [2, dept, `${dept} Department`]);
  });

  // Seed Employee Groups for Entity 1
  ['Executive', 'Operations', 'Contractors', 'General'].forEach(group => {
    database.run(`INSERT INTO employee_groups (entity_id, name, description) VALUES (?, ?, ?)`, [1, group, `${group} Group`]);
  });
  // Seed Employee Groups for Entity 2
  ['Executive', 'General'].forEach(group => {
    database.run(`INSERT INTO employee_groups (entity_id, name, description) VALUES (?, ?, ?)`, [2, group, `${group} Group`]);
  });

  // Seed Employee Grades
  ['A1', 'B2', 'Executive', 'Staff'].forEach(grade => {
    database.run(`INSERT INTO employee_grades (entity_id, name, description) VALUES (?, ?, ?)`, [1, grade, `${grade} Grade`]);
  });
  ['Executive', 'Staff'].forEach(grade => {
    database.run(`INSERT INTO employee_grades (entity_id, name, description) VALUES (?, ?, ?)`, [2, grade, `${grade} Grade`]);
  });

  // Seed Email Domains
  ['hypex.com.sg', 'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].forEach(domain => {
    database.run(`INSERT INTO email_domains (entity_id, domain) VALUES (?, ?)`, [1, domain]);
    database.run(`INSERT INTO email_domains (entity_id, domain) VALUES (?, ?)`, [2, domain]);
  });

  // Seed Public Holidays for Singapore (Entity 1 & 2)
  const currentYear = new Date().getFullYear();
  const holidays = [
    ['New Year\'s Day', `${currentYear}-01-01`],
    ['Chinese New Year', `${currentYear}-02-17`], // Approximate
    ['Good Friday', `${currentYear}-04-03`], // Approximate
    ['Labour Day', `${currentYear}-05-01`],
    ['Vesak Day', `${currentYear}-05-31`], // Approximate
    ['National Day', `${currentYear}-08-09`],
    ['Deepavali', `${currentYear}-10-20`], // Approximate
    ['Christmas Day', `${currentYear}-12-25`]
  ];

  holidays.forEach(([name, date]) => {
    database.run(`INSERT INTO holidays (entity_id, name, date) VALUES (?, ?, ?)`, [1, name, date]);
    database.run(`INSERT INTO holidays (entity_id, name, date) VALUES (?, ?, ?)`, [2, name, date]);
  });
}

module.exports = { getDb, saveDb, reloadDb };
