const path = require("path")
const fs = require("fs")
const pup = require("puppeteer")
const {performance} = require('perf_hooks');


exports.getJSON = async (req, res) => {
    console.log(req.body)
    res.send("hola")
}