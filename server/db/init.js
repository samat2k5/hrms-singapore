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
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    createSchema(db);
  } else {
    db = new SQL.Database();
    createSchema(db);
    seedData(db);
    seedConfigData(db);
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
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function createSchema(database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      uen TEXT UNIQUE NOT NULL,
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
      nationality TEXT DEFAULT 'Citizen',
      tax_residency TEXT DEFAULT 'Resident',
      race TEXT,
      designation TEXT,
      department TEXT,
      employee_group TEXT,
      date_joined DATE,
      basic_salary REAL,
      transport_allowance REAL,
      meal_allowance REAL,
      other_allowance REAL,
      bank_name TEXT,
      bank_account TEXT,
      cpf_applicable BOOLEAN DEFAULT 1,
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
      employee_group TEXT NOT NULL,
      period_year INTEGER NOT NULL,
      period_month INTEGER NOT NULL,
      run_date DATE NOT NULL,
      total_gross REAL DEFAULT 0,
      total_cpf_employee REAL DEFAULT 0,
      total_cpf_employer REAL DEFAULT 0,
      total_sdl REAL DEFAULT 0,
      total_shg REAL DEFAULT 0,
      total_net REAL DEFAULT 0,
      status TEXT DEFAULT 'Draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      bonus REAL DEFAULT 0,
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
      net_pay REAL DEFAULT 0,
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
      ot_hours REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(entity_id) REFERENCES entities(id),
      FOREIGN KEY(employee_id) REFERENCES employees(id),
      UNIQUE(entity_id, employee_id, date)
    )
  `);
}

function seedData(database) {
  // Default admin user (sees everything) and restricted HR user
  const adminHash = bcrypt.hashSync('admin123', 10);
  const hrHash = bcrypt.hashSync('hr123', 10);

  // Entities
  database.run(
    `INSERT INTO entities (name, uen) VALUES (?, ?)`,
    ['Acme Corp Tech (Singapore) Pte Ltd', '202012345A']
  );
  database.run(
    `INSERT INTO entities (name, uen) VALUES (?, ?)`,
    ['Acme Corp Services (Singapore) Pte Ltd', '202054321B']
  );

  // Default User Roles
  database.run(`INSERT INTO user_roles (name, description) VALUES (?, ?)`, ['Admin', 'Full system access']);
  database.run(`INSERT INTO user_roles (name, description) VALUES (?, ?)`, ['HR', 'Human resources and payroll management']);

  database.run(
    `INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?)`,
    ['admin', adminHash, 'System Administrator']
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
    ['Annual Leave', 7],
    ['Medical Leave', 14],
    ['Hospitalization Leave', 60],
    ['Childcare Leave', 6],
    ['Maternity Leave', 112],   // 16 weeks = 112 days
    ['Paternity Leave', 14],    // 2 weeks = 14 days
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
  const employees = [
    [1, 'EMP001', 'Tan Wei Ming', '1990-05-15', 'S1234567A', 'Citizen', 'Resident', 'Chinese', 'Software Engineer', 'Technology', 'Executive', '2023-01-15', 5500, 200, 150, 0, 'DBS Bank', '1234567890', 1],
    [1, 'EMP002', 'Priya Sharma', '1988-11-22', 'S7654321B', 'PR', 'Resident', 'Indian', 'Senior Analyst', 'Finance', 'Executive', '2022-06-01', 7200, 300, 150, 100, 'OCBC Bank', '2345678901', 1],
    [1, 'EMP003', 'Ahmad bin Hassan', '1985-03-10', 'S1112223C', 'Citizen', 'Resident', 'Malay', 'Operations Manager', 'Operations', 'Operations', '2021-03-20', 8500, 400, 200, 0, 'UOB Bank', '3456789012', 1],
    [1, 'EMP004', 'Sarah Pereira', '1992-08-30', 'S4445556D', 'Citizen', 'Resident', 'Eurasian', 'HR Executive', 'Human Resources', 'Executive', '2023-09-01', 4800, 200, 100, 0, 'DBS Bank', '4567890123', 1],
    [2, 'EMP005', 'Lim Jia Hui', '1965-01-20', 'S8889990E', 'Citizen', 'Resident', 'Chinese', 'Senior Consultant', 'Advisory', 'Executive', '2018-04-10', 9500, 500, 200, 200, 'OCBC Bank', '5678901234', 1],
  ];

  employees.forEach(emp => {
    database.run(
      `INSERT INTO employees (entity_id, employee_id, full_name, date_of_birth, national_id, nationality, tax_residency, race, designation, department, employee_group, date_joined, basic_salary, transport_allowance, meal_allowance, other_allowance, bank_name, bank_account, cpf_applicable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      emp
    );
  });

  // Seed KETs for sample employees
  const currentYear = new Date().getFullYear();
  employees.forEach((emp, idx) => {
    database.run(
      `INSERT INTO employee_kets (employee_id, job_title, employment_start_date, employment_type, working_hours_per_day, working_days_per_week, rest_day, salary_period, basic_salary, fixed_allowances, overtime_rate, annual_leave_days, sick_leave_days, hospitalization_days, probation_months, notice_period, issued_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [idx + 1, emp[8], emp[11], 'Permanent', 8, 5, 'Sunday', 'Monthly', emp[12],
      JSON.stringify({ transport: emp[13], meal: emp[14] }), 0, 14, 14, 60, 3, '1 month', emp[11]]
    );
  });

  // Seed leave balances for current year
  const leaveTypeCount = leaveTypes.length;
  for (let empId = 1; empId <= employees.length; empId++) {
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

module.exports = { getDb, saveDb };
