const express = require("express")
const app = express()
const cors = require("cors")
const hemlet = require("helmet");
const pup = require("puppeteer")
const morgan = require("morgan"); 
app.use(cors())
app.use(hemlet())
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan("dev"));

const port = process.env.PORT || "4000";

//middleware que inicializa el servidor con una instancia de chrome
app.use( async (req, res, next) => {
    res.locals.browser = await pup.launch({headless: false})
    next();
})
app.use('/api', require("./routes/route-getJSON"))
app.listen(port, ()=>{
    console.log("escuchando en puerto: " + port)
})