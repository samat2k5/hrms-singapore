const jwt = require('jsonwebtoken'); console.log(jwt.sign({ id: 1, role: 'Admin', entityId: 1 }, 'hrms_super_secret_key_2024'));
