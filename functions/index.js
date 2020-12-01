const functions = require('firebase-functions');
const admin = require("firebase-admin")
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

admin.initializeApp(/*{
    credential: admin.credential.cert('./credencials.json'),
    databaseURL: "https://tfg-web-scrapping.firebaseio.com"
  }*/);
//middleware que inicializa el servidor con una instancia de chrome
app.use( async (req, res, next) => {
    res.locals.browser = await pup.launch({headless: true, args: ['--no-sandbox']})
    next();
})

app.get( "/hello", (req, res)=> {
    res.send("hola caracola")
})
app.use('/api', require("./routes/route-getJSON"))

/* NECESITAMOS ESTO PARA ELECTRON
app.listen(port, ()=>{
    console.log("escuchando en puerto: " + port)
})
*/

exports.app = functions.runWith({memory: '512MB', timeoutSeconds: 540}).https.onRequest(app)