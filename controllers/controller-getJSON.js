const path = require("path")
const fs = require("fs")
const {performance} = require('perf_hooks');
const stringHelper = require("../utils/stringHelper")
//Refactorizar esta funcion en otras mas pequeñas
exports.getJSON = async (req, res) => {
    let autores = req.body;
    console.log(autores)
    let page = await res.locals.browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', req => {
        if (req.resourceType() === 'image' ||  req.resourceType() === 'media')
            req.abort();
        else
            req.continue();
        });
    await page.setDefaultNavigationTimeout(0) //dejamos en infinito el tiempo que puede tardar la pagina en cargar
    await page.setViewport({width: 1920, height: 1080})
    let datosAutores = [], datosPublicaciones = []; //arrays donde meteremos los datos extraidos de cada autor y publicaciones, resultado final a procesar
    for(let i = 0; i < autores.length; i++){
        //este objeto se completa durante la iteracion del for y se introduce en el array de autores
        let datosAutor = {
            "name" : autores[i]
        }
        await page.goto("https://dblp.org/", {waitUntil: "networkidle2"})
        await page.waitForTimeout(2000);
        await page.type('input[type="search"]', autores[i])
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2000);
        //Vamos a obtener un objeto con los enlaces separados de los tipos article, uncollections e inproceedings, descartando los informal
        const results = await page.evaluate( () => {
            let articlesParse = [], inproceedingsParse = [], incollectionParse = [];
            let articles = document.querySelectorAll(".entry.article nav.publ ul li:nth-child(2) div.body ul li:nth-child(5) a");
            let inproceedings = document.querySelectorAll(".entry.inproceedings nav.publ ul li:nth-child(2) div.body ul li:nth-child(5) a");
            let incollection = document.querySelectorAll(".entry.incollection nav.publ ul li:nth-child(2) div.body ul li:nth-child(5) a");
            let results = {};
            for(let i = 0; i < articles.length; i++){
                articlesParse.push(articles[i].href)
            }
            for(let i = 0; i < inproceedings.length; i++){
                inproceedingsParse.push(inproceedings[i].href)
            }
            for(let i = 0; i < incollection.length; i++){
                incollectionParse.push(incollection[i].href)
            }
            results.articles = articlesParse;
            results.inproceedings = inproceedingsParse;
            results.incollection = incollectionParse;
            return results;
        })  
        //Una vez tienes el 100% de enlaces de la web hacia los XML, procedemos a ir a ellos y extraer la info para completar los arrays
        for(let j = 0; j < results.articles.length; j++){
            datosArticulo = {}
            await page.goto(results.articles[j], {waitUntil: "networkidle2"})
            let extraerInfoXML = await page.evaluate( () => {
                return document.querySelector(".opened").innerText;
            }, [])
            /*
                Aqui traigo el contenido del xlm a un string, toca leer la info de este string y completar, idoneo crear una carpeta utils donde crear funciones
                especificas para leer y procesar string (dividirlos por lineas, quitar acentos, quitar mayusculas, leer si un string tiene cadenas especificas como <author>
                y todo lo que necesitemos)
            */
            console.log(extraerInfoXML)

            //en este for hay que abrir nuevas pestañas al navegador y mandarlas a otras webs para calcular algunos indices que se basan en el acronimo de los articulos

            /*Controlar si este articulo ya esta incluido en el array datosPublicaciones, ejemplo si nos dan dos autores de los cuales extraer info
            y adrian y verdejo han participado en el mismo articulo, cuando procesas adrian por primera vez lo incluyes, pero cuando procesas a verdejo
            ese articulo ya esta incluido, por lo que no se debe incluir otra vez pero si lo debes usar para calcular los indices de verdejo y demas*/
        }

    }
    
    res.send("Si lo intento hasta lograrlo... Lo lograre")
}

