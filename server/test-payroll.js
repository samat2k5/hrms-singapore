const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsImZ1bGxfbmFtZSI6IlN5c3RlbSBBZG1pbmlzdHJhdG9yIiwiaWF0IjoxNzcxODU0NDk2fQ.cdJmqGS5l916ZKR67pz0UGqobsVY_iJO-SWoNgO11yg";

fetch('http://localhost:5000/api/payroll/run', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Entity-Id': '1',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        year: 2025,
        month: 2,
        employee_group: 'Operations'
    })
})
    .then(res => res.json())
    .then(data => {
        console.log(JSON.stringify(data, null, 2));
    })
    .catch(err => console.error(err));
