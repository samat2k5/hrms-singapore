const fs = require('fs');
const PDFParser = require('pdf2json');
const path = require('path');

const pdfParser = new PDFParser(this, 1);

pdfParser.on('pdfParser_dataError', errData => console.error(errData.parserError));
pdfParser.on('pdfParser_dataReady', pdfData => {
    fs.writeFileSync('./leave-pdf-extracted.txt', pdfParser.getRawTextContent());
    console.log('Successfully extracted PDF!');
});

pdfParser.loadPDF(path.join(__dirname, '../Leave Configuration.pdf'));
