const fs = require('fs');
const PDFParser = require("pdf2json");

let pdfParser = new PDFParser(this, 1);

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    console.log("PDF TEXT EXTRACTED:\n", pdfParser.getRawTextContent());
});

pdfParser.loadPDF("c:/Users/mathi/Desktop/AntiGravity Demos/HRMS Singapore/IRAS_types-of-controls-for-payroll-software.pdf");
