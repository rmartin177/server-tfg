const path = require("path")
const fs = require("fs")
const pup = require("puppeteer")
const {performance} = require('perf_hooks');


exports.getJSON = async (req, res) => {
    res.send("hola")
}