/**
 * IRAS Engine 2026
 * Handles mapping and calculation for IR8A, Appendix 8A, and Appendix 8B.
 */

function calculateIR8A(employee, aggregations, biks, shares) {
    const totalBIK = biks.reduce((sum, b) => sum + (b.value || 0), 0);
    const totalShareGain = shares.reduce((sum, s) => sum + (s.taxable_profit || 0), 0);

    // Basic IR8A Data Structure (AIS 2.0 Simplified)
    const ir8a = {
        employee_details: {
            id_no: employee.national_id,
            id_type: employee.nationality === 'Singapore Citizen' || employee.nationality === 'Permanent Resident' ? 'NRIC' : 'FIN',
            name: employee.full_name,
            nationality: employee.nationality,
            gender: employee.gender,
            dob: employee.date_of_birth
        },
        income: {
            gross_salary: aggregations.total_gross || 0,
            bonus: aggregations.total_bonus || 0,
            director_fees: 0, // Placeholder
            allowances: 0, // Placeholder
            gross_commission: 0,
            pension: 0,
            transport_allowance: aggregations.total_transport || 0,
            entertainment_allowance: 0,
            other_allowances: aggregations.total_other_allowance || 0,
            benefits_in_kind: totalBIK,
            share_options_gain: totalShareGain,
            total_income: (aggregations.total_gross || 0) + totalBIK + totalShareGain
        },
        deductions: {
            cpf_employee: aggregations.total_cpf || 0,
            donation: 0, // Placeholder
            insurance: 0
        },
        appendix_8a: biks.length > 0 ? {
            items: biks.map(b => ({
                category: b.category,
                description: b.description,
                value: b.value,
                period_from: b.period_from,
                period_to: b.period_to
            })),
            total_value: totalBIK
        } : null,
        appendix_8b: shares.length > 0 ? {
            items: shares.map(s => ({
                plan_type: s.plan_type,
                grant_date: s.grant_date,
                exercise_date: s.exercise_date,
                exercise_price: s.exercise_price,
                market_value: s.market_value,
                shares_count: s.shares_count,
                gain: s.taxable_profit
            })),
            total_gain: totalShareGain
        } : null
    };

    return ir8a;
}

/**
 * Maps multiple employees' IR8A into a single AIS 2.0 JSON payload
 */
function generateAISPayload(entity, year, ir8aRecords) {
    return {
        header: {
            source: "ezyHR-AIS-API-2.0",
            uen: entity.uen,
            batch_id: `AIS-${year}-${Date.now()}`,
            year_of_assessment: year + 1,
            record_type: "Original",
            records_count: ir8aRecords.length
        },
        records: ir8aRecords.map(rec => ({
            employee_info: rec.employee_details,
            employment_income: rec.income,
            statutory_contributions: rec.deductions,
            appendix_8a: rec.appendix_8a,
            appendix_8b: rec.appendix_8b
        }))
    };
}

module.exports = {
    calculateIR8A,
    generateAISPayload
};
