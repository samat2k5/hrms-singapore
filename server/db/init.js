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

    // Entity Migrations
    try {
      const check = db.exec("PRAGMA table_info(entities)");
      if (check.length > 0) {
        const columns = check[0].values.map(v => v[1]);
        if (!columns.includes('performance_multiplier')) {
          console.log('[DB] Migrating entities: Adding performance_multiplier...');
          db.run(`ALTER TABLE entities ADD COLUMN performance_multiplier REAL DEFAULT 0`);
        }
        if (!columns.includes('logo_url')) {
          console.log('[DB] Migrating entities: Adding logo_url...');
          db.run(`ALTER TABLE entities ADD COLUMN logo_url TEXT`);
        }
        saveDb();
      }
    } catch (e) { console.error('[DB] Entities migration failed:', e.message); }

    // Employee Face Descriptor Migration
    try {
      const check = db.exec("PRAGMA table_info(employees)");
      if (check.length > 0) {
        const columns = check[0].values.map(v => v[1]);
        if (!columns.includes('face_descriptor')) {
          console.log('[DB] Migrating employees: Adding face_descriptor...');
          db.run(`ALTER TABLE employees ADD COLUMN face_descriptor TEXT`);
          saveDb();
        }
      }
    } catch (e) { console.error('[DB] Employee face migration failed:', e.message); }

    // MOM Alignment Migrations
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
          try { if (!columns.includes(col.name)) db.run(`ALTER TABLE employee_kets ADD COLUMN ${col.name} ${col.type}`); } catch (e) { }
        }
        saveDb();
      }
    } catch (e) { console.error('[DB] MOM migration failed:', e.message); }

    // Shift Settings Migrations
    try {
      const check = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='shift_settings'");
      if (check.length > 0) {
        const columnsData = db.exec("PRAGMA table_info(shift_settings)");
        const columns = columnsData[0].values.map(v => v[1]);
        const migrations = [
          { name: 'lunch_break_mins', type: 'INTEGER DEFAULT 60' },
          { name: 'dinner_break_mins', type: 'INTEGER DEFAULT 0' },
          { name: 'midnight_break_mins', type: 'INTEGER DEFAULT 0' }
        ];
        let migrated = false;
        for (const col of migrations) {
          if (!columns.includes(col.name)) {
            db.run(`ALTER TABLE shift_settings ADD COLUMN ${col.name} ${col.type}`);
            migrated = true;
          }
        }
        if (migrated) saveDb();
      }
    } catch (e) { }

    // NEW SELF-HEALING: Seed default groups for entities that have none
    try {
      const entities = db.exec("SELECT id FROM entities");
      if (entities.length > 0) {
        const entityIds = entities[0].values.map(v => v[0]);
        let seeded = false;
        for (const eid of entityIds) {
          const groupCount = db.exec("SELECT COUNT(*) FROM employee_groups WHERE entity_id = ?", [eid]);
          if (groupCount[0].values[0][0] === 0) {
            console.log(`[DB] Seeding default groups for entity ${eid}...`);
            db.run(`INSERT INTO employee_groups (entity_id, name, description) VALUES (?, ?, ?)`, [eid, 'General', 'General Group']);
            db.run(`INSERT INTO employee_groups (entity_id, name, description) VALUES (?, ?, ?)`, [eid, 'Executive', 'Executive Group']);
            db.run(`INSERT INTO employee_groups (entity_id, name, description) VALUES (?, ?, ?)`, [eid, 'Operations', 'Operations Group']);
            seeded = true;
          }
        }
        if (seeded) saveDb();
      }
    } catch (e) { console.error('[DB] Group seeding failed:', e.message); }

  } else {
    db = new SQL.Database();
    createSchema(db);
    seedData(db);
    seedConfigData(db);
    saveDb();
  }

  // Ensure default roles exist
  try {
    const rolesCheck = db.exec("SELECT COUNT(*) FROM user_roles");
    if (rolesCheck[0].values[0][0] === 0) {
      db.run(`INSERT INTO user_roles (name, description, permissions) VALUES (?, ?, ?)`, ['Admin', 'Full system access', JSON.stringify(['attendance:import:cross-entity'])]);
      db.run(`INSERT INTO user_roles (name, description, permissions) VALUES (?, ?, ?)`, ['HR', 'Human resources and payroll management', JSON.stringify(['attendance:import:cross-entity'])]);
      db.run(`INSERT INTO user_roles (name, description, permissions) VALUES (?, ?, ?)`, ['Operations Admin', 'Admin access to operations only. Restricted from Entity, Users, Roles masters.', JSON.stringify(['attendance:import:cross-entity'])]);
      saveDb();
    } else {
      // Check if Operations Admin exists, if not add it
      const opsAdminCheck = db.exec("SELECT id FROM user_roles WHERE name = 'Operations Admin'");
      if (!opsAdminCheck.length || !opsAdminCheck[0].values.length) {
        console.log('[DB] Adding missing Operations Admin role...');
        db.run(`INSERT INTO user_roles (name, description, permissions) VALUES (?, ?, ?)`, ['Operations Admin', 'Admin access to operations only. Restricted from Entity, Users, Roles masters.', JSON.stringify(['attendance:import:cross-entity'])]);
        saveDb();
      }
    }
  } catch (e) { console.error('[DB] User roles check/seed failed:', e.message); }

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
      logo_url TEXT,
      performance_multiplier REAL DEFAULT 0,
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
      face_descriptor TEXT,
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

  database.run(`
    CREATE TABLE IF NOT EXISTS shift_settings_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER NOT NULL,
      shift_name TEXT NOT NULL,
      start_time TEXT DEFAULT '08:00',
      end_time TEXT DEFAULT '17:00',
      ot_start_time TEXT DEFAULT '17:30',
      late_arrival_threshold_mins INTEGER DEFAULT 15,
      early_departure_threshold_mins INTEGER DEFAULT 15,
      late_arrival_penalty_block_mins INTEGER DEFAULT 0,
      early_departure_penalty_block_mins INTEGER DEFAULT 0,
      compulsory_ot_hours REAL DEFAULT 0,
      lunch_break_mins INTEGER DEFAULT 60,
      dinner_break_mins INTEGER DEFAULT 0,
      midnight_break_mins INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id),
      UNIQUE(entity_id, shift_name)
    )
  `);
}

function seedData(database) {
  const systemHash = bcrypt.hashSync('manager', 10);
  database.run(`INSERT INTO entities (name, uen, address, contact_number, website, email_domains) VALUES (?, ?, ?, ?, ?, ?)`, ['Hypex Pte Ltd', '202012345A', '123 Tech Lane, Singapore', '65432100', 'https://hypex.sg', 'hypex.com.sg, gmail.com, yahoo.com']);
  database.run(`INSERT INTO entities (name, uen, address, contact_number, website, email_domains) VALUES (?, ?, ?, ?, ?, ?)`, ['Samat Global', '202167890B', '456 Global Way, Singapore', '67890011', 'https://samat.com', 'samat.com, gmail.com']);

  database.run(`INSERT INTO user_roles (name, description, permissions) VALUES (?, ?, ?)`, ['Admin', 'Full system access', JSON.stringify(['attendance:import:cross-entity'])]);
  database.run(`INSERT INTO user_roles (name, description, permissions) VALUES (?, ?, ?)`, ['HR', 'Human resources and payroll management', JSON.stringify(['attendance:import:cross-entity'])]);
  database.run(`INSERT INTO user_roles (name, description, permissions) VALUES (?, ?, ?)`, ['Operations Admin', 'Admin access to operations only. Restricted from Entity, Users, Roles masters.', JSON.stringify(['attendance:import:cross-entity'])]);

  database.run(`INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?)`, ['system', systemHash, 'System Administrator']);
  database.run(`INSERT INTO user_entity_roles (user_id, entity_id, role, managed_groups) VALUES (?, ?, ?, ?)`, [1, 1, 'Admin', '[]']);
  database.run(`INSERT INTO user_entity_roles (user_id, entity_id, role, managed_groups) VALUES (?, ?, ?, ?)`, [1, 2, 'Admin', '[]']);
}

function seedConfigData(database) {
  // MOM-compliant leave types
  const leaveTypes = [
    ['Annual Leave', 7],
    ['Medical Leave', 14],
    ['Hospitalization Leave', 60],
    ['Childcare Leave', 6],
    ['Maternity Leave', 112],
    ['Paternity Leave', 24],
    ['Shared Parental Leave', 60],
    ['Compassionate Leave', 3],
    ['Unpaid Leave', 0]
  ];
  leaveTypes.forEach(([name, days]) => {
    database.run(`INSERT INTO leave_types (name, default_days) VALUES (?, ?)`, [name, days]);
  });
}

module.exports = { getDb, saveDb, reloadDb };
