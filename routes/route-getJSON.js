const express = require("express");
const router = express.Router();
const controllerGetJSON = require("../controllers/controller-getJSON")


router.post("/api/getjson", controllerGetJSON)

module.exports = router;