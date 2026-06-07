const express = require('express');
const router = express.Router();
const { createOptionSet, getAllOptionSets, getOptionSetByName, addOption, updateOption, deleteOption } = require('../controllers/optionsetController');

router.post("/create", createOptionSet);
router.get("/", getAllOptionSets);
router.get("/:name", getOptionSetByName);

// Options inside OptionSet
router.post("/:optionSetId/options", addOption);
router.put("/:optionSetId/options/:optionId", updateOption);
router.delete("/:optionSetId/options/:optionId", deleteOption);

module.exports = router;