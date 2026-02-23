const http = require('http'); http.get('http://localhost:5000/api/entities', (res) => { res.on('data', chunk => console.log(chunk.toString())); });
