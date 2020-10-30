const express = require("express")
const app = express()
const cors = require("cors")
const hemlet = require("helmet");
const pup = require("puppeteer")
const morgan = require("morgan"); 
app.use(cors())
app.use(hemlet())

const port = process.env.port || 4000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan("dev"));

//middleware que inicializa el servidor con una instancia de chrome
app.use( async (req, res, next) => {
    res.locals.browser = await pup.launch({headless: false})
    next();
})
app.use('/api', require("./routes/route-getJSON"))
app.listen(port, "0.0.0.0", ()=>{
    console.log("escuchando en puerto: " + port)
})