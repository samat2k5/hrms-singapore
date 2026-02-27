function toObjects(result) {
    if (!result || !result.length) return [];
    const { columns, values } = result[0];
    return values.map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
    });
}

/**
 * Generates a full-month attendance report for an employee.
 * @param {object} db - SQLite database instance
 * @param {string|number} empId - Employee ID (Primary Key)
 * @param {string|number} year - Period Year
 * @param {string|number} month - Period Month (1-indexed)
 * @param {string|number} entityId - Entity ID
 * @returns {Array} List of attendance objects for each day in the month
 */
function generateMonthlyAttendanceReport(db, empId, year, month, entityId) {
    const monthPadded = String(month).padStart(2, '0');
    const yearStr = String(year);

    // 1. Fetch holidays
    const holidays = toObjects(db.exec(
        'SELECT date, name FROM holidays WHERE entity_id = ? AND strftime(\'%Y\', date) = ? AND strftime(\'%m\', date) = ?',
        [entityId, yearStr, monthPadded]
    ));

    // 2. Fetch timesheets
    const timesheets = toObjects(db.exec(
        'SELECT * FROM timesheets WHERE employee_id = ? AND strftime(\'%Y\', date) = ? AND strftime(\'%m\', date) = ?',
        [empId, yearStr, monthPadded]
    ));

    // 3. Fetch approved leave requests
    const leaves = toObjects(db.exec(`
        SELECT lr.*, lt.name as leave_type_name 
        FROM leave_requests lr 
        JOIN leave_types lt ON lr.leave_type_id = lt.id 
        WHERE lr.employee_id = ? AND lr.status = 'Approved'
        AND ((strftime('%Y', lr.start_date) = ? AND strftime('%m', lr.start_date) = ?)
        OR (strftime('%Y', lr.end_date) = ? AND strftime('%m', lr.end_date) = ?))
    `, [empId, yearStr, monthPadded, yearStr, monthPadded]));

    // 4. Fetch Employee Details for Rest Day
    const emp = toObjects(db.exec('SELECT rest_day FROM employees WHERE id = ?', [empId]))[0];

    const dayMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
    const restDayIdx = dayMap[emp?.rest_day] !== undefined ? dayMap[emp.rest_day] : 0;

    const daysInMonth = new Date(year, month, 0).getDate();
    const result = [];

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${yearStr}-${monthPadded}-${String(d).padStart(2, '0')}`;
        const dateObj = new Date(dateStr);
        const dayOfWeek = dateObj.getDay();

        const dayInfo = {
            date: dateStr,
            dayName: dateObj.toLocaleDateString('en-SG', { weekday: 'short' }),
            status: 'Present',
            in_time: '-',
            out_time: '-',
            remarks: '',
            shift: '-',
            normal_hours: '-',
            ot_1_5_hours: '-',
            ot_2_0_hours: '-',
            ph_hours: '-'
        };

        // Check if Rest Day
        if (dayOfWeek === restDayIdx) dayInfo.status = 'Rest Day';

        // Check if Holiday
        const hol = holidays.find(h => h.date === dateStr);
        if (hol) {
            dayInfo.status = 'Public Holiday';
            dayInfo.remarks = hol.name;
        }

        // Check for Leave
        const leave = leaves.find(l => dateStr >= l.start_date && dateStr <= l.end_date);
        if (leave) {
            dayInfo.status = leave.leave_type_name;
            dayInfo.remarks = leave.reason || '';
        }

        // Check Timesheets
        const ts = timesheets.find(t => t.date === dateStr);
        const fmt = (v) => (v === 0 || v === '0' || !v) ? '-' : v;

        if (ts) {
            dayInfo.in_time = ts.in_time || '-';
            dayInfo.out_time = ts.out_time || '-';
            dayInfo.shift = ts.shift || 'Day';
            dayInfo.normal_hours = fmt(ts.normal_hours);
            dayInfo.ot_1_5_hours = fmt(ts.ot_1_5_hours);
            dayInfo.ot_2_0_hours = fmt(ts.ot_2_0_hours);
            dayInfo.ph_hours = fmt(ts.ph_hours);

            if (dayInfo.status !== 'Present') {
                dayInfo.remarks = `${dayInfo.status} (Worked)`;
                dayInfo.status = 'Worked';
            } else {
                dayInfo.remarks = ts.remarks || '';
            }
        } else {
            if (dayInfo.status === 'Present') {
                dayInfo.status = 'Absent';
                dayInfo.remarks = 'AWOL';
            } else {
                dayInfo.remarks = dayInfo.status;
                dayInfo.status = '-';
            }
        }
        result.push(dayInfo);
    }

    return result;
}

module.exports = { generateMonthlyAttendanceReport };
