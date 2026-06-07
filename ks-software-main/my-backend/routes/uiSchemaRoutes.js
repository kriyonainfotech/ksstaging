const express = require('express');
const router = express.Router();
const { getSchema, updateSchema } = require('../controllers/uiSchemaController');

// GET /api/ui-schema/task
router.get('/:resource', getSchema);

// POST /api/ui-schema (To save new fields)
router.post('/', updateSchema);

module.exports = router;