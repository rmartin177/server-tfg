const express = require("express");
const router = express.Router();
const controllerGetJSON = require("../controllers/controller-getJSON")


router.post("/getjson", controllerGetJSON.getJSON)

module.exports = router;