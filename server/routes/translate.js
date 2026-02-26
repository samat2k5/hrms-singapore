const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

const DICTIONARY = {
    'Mandarin': {
        'Job Title': '职位',
        'Main Duties and Responsibilities': '主要职责',
        'Employment Start Date': '聘用开始日期',
        'Employment Type': '聘用类型',
        'Working Hours': '工作时间',
        'Rest Day': '休息日',
        'Salary Period': '工薪期',
        'Basic Salary': '基本薪金',
        'Fixed Allowances': '固定津贴',
        'Overtime Rate': '加班费率',
        'Notice Period': '离职预告期',
        'Medical Benefits': '医疗福利',
        'Leave Entitlement': '休假权利',
        'Place of Work': '工作地点',
        'Permanent': '兼职',
        'Full-Time': '全职',
        'Part-Time': '兼职',
        'Monday': '周一',
        'Tuesday': '周二',
        'Wednesday': '周三',
        'Thursday': '周四',
        'Friday': '周五',
        'Saturday': '周六',
        'Sunday': '周日',
        'Monthly': '每月',
        'Weekly': '每周'
    },
    'Tamil': {
        'Job Title': 'வேலை தலைப்பு',
        'Main Duties and Responsibilities': 'முக்கிய கடமைகள் மற்றும் பொறுப்புகள்',
        'Employment Start Date': 'வேலை தொடக்க தேதி',
        'Employment Type': 'வேலை வகை',
        'Working Hours': 'வேலை நேரம்',
        'Rest Day': 'ஓய்வு நாள்',
        'Salary Period': 'சம்பள காலம்',
        'Basic Salary': 'அடிப்படை சம்பளம்',
        'Fixed Allowances': 'நிலையான கொடுப்பனவுகள்',
        'Overtime Rate': 'கூடுதல் நேர கட்டணம்',
        'Notice Period': 'அறிவிப்பு காலம்',
        'Medical Benefits': 'மருத்துவ நன்மைகள்',
        'Leave Entitlement': 'விடுப்பு உரிமை',
        'Place of Work': 'வேலை செய்யும் இடம்',
        'Permanent': 'நிலையானது',
        'Full-Time': 'முழு நேரம்',
        'Part-Time': 'பகுதி நேரம்',
        'Sunday': 'ஞாயிறு',
        'Monday': 'திங்கள்',
        'Tuesday': 'செவ்வாய்',
        'Wednesday': 'புதன்',
        'Thursday': 'வியாழன்',
        'Friday': 'வெள்ளி',
        'Saturday': 'சனி',
        'Monthly': 'மாதாந்திரம்',
        'Weekly': 'வாராந்திரம்'
    },
    'Malay': {
        'Job Title': 'Jawatan',
        'Main Duties and Responsibilities': 'Tugas dan Tanggungjawab Utama',
        'Employment Start Date': 'Tarikh Mula Kerja',
        'Employment Type': 'Jenis Pekerjaan',
        'Working Hours': 'Waktu Kerja',
        'Rest Day': 'Hari Rehat',
        'Salary Period': 'Tempoh Gaji',
        'Basic Salary': 'Gaji Pokok',
        'Fixed Allowances': 'Elaun Tetap',
        'Overtime Rate': 'Kadar Kerja Lebih Masa',
        'Notice Period': 'Tempoh Notis',
        'Medical Benefits': 'Faedah Perubatan',
        'Leave Entitlement': 'Kelayakan Cuti',
        'Place of Work': 'Tempat Kerja',
        'Permanent': 'Tetap',
        'Full-Time': 'Sepenuh Masa',
        'Part-Time': 'Sambilan',
        'Sunday': 'Ahad',
        'Monday': 'Isnin',
        'Tuesday': 'Selasa',
        'Wednesday': 'Rabu',
        'Thursday': 'Khamis',
        'Friday': 'Jumaat',
        'Saturday': 'Sabtu',
        'Monthly': 'Bulanan',
        'Weekly': 'Mingguan'
    }
};

// Simple translator function
function translateText(text, targetLang) {
    if (!text || targetLang === 'English') return text;
    const langDict = DICTIONARY[targetLang];
    if (!langDict) return text;

    // Check if whole text is in dictionary
    if (langDict[text]) return langDict[text];

    // Try to translate common phrases if it looks like a standard term
    // For long custom text, we append a simulated translation marker if not in dict
    // in a real app, this would hit an LLM or Translation API
    return langDict[text] || `[${targetLang}] ${text}`;
}

router.post('/', authMiddleware, async (req, res) => {
    try {
        const { text, targetLanguage } = req.body;
        if (!text) return res.status(400).json({ error: 'Text is required' });

        const translated = translateText(text, targetLanguage);
        res.json({ original: text, translated, targetLanguage });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
