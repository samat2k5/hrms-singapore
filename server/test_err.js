const http = require('http'); http.get('http://localhost:5173/entities', (res) => { res.on('data', chunk => console.log(chunk.toString())); });
