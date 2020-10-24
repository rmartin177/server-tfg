const path = require("path")
const fs = require("fs")
const {performance} = require('perf_hooks');
const stringHelper = require("../utils/stringHelper")
const scrappingFilter = require("../utils/scrappingFilter")
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
        await autoScroll(page)
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
            datosArticulo = { type : "article", authors: [], issue: null}
            await page.goto(results.articles[j], {waitUntil: "networkidle2"})
            let extraerInfoXML = await page.evaluate( (datosArticulo) => {
                let articleDataHTML = document.querySelectorAll("#folder1 .opened .line span:nth-child(2):not(.html-attribute-value)")
                let articleTypeDataHTML = document.querySelectorAll("#folder1 .opened .line > span:first-child")

                for(let z = 0; z < articleDataHTML.length; z++){
                    if(articleTypeDataHTML[z].innerText.includes("author")){
                        datosArticulo.authors.push(articleDataHTML[z].innerText)
                    }else if(articleTypeDataHTML[z].innerText.includes("title")){
                        datosArticulo.title = articleDataHTML[z].innerText;
                    }else if(articleTypeDataHTML[z].innerText.includes("pages")){
                        datosArticulo.pages = articleDataHTML[z].innerText;
                    }else if(articleTypeDataHTML[z].innerText.includes("year")){
                        datosArticulo.year = articleDataHTML[z].innerText;
                    }else if(articleTypeDataHTML[z].innerText.includes("volume")){
                        datosArticulo.volume = articleDataHTML[z].innerText;
                    }else if(articleTypeDataHTML[z].innerText.includes("journal")){
                        datosArticulo.journal = articleDataHTML[z].innerText;
                    }else if(articleTypeDataHTML[z].innerText.includes("issue")){
                        datosArticulo.issue = articleDataHTML[z].innerText;
                    }
                }
                return datosArticulo;
            }, datosArticulo)
            datosPublicaciones.push(extraerInfoXML);
             //en este for hay que abrir nuevas pestañas al navegador y mandarlas a otras webs para calcular algunos indices que se basan en el acronimo de los articulos
        }

        for(let j = 0; j < results.inproceedings.length; j++){
            datosArticulo = { type : "inproceeding", authors: []}
            await page.goto(results.inproceedings[j], {waitUntil: "networkidle2"})
            let extraerInfoXML = await page.evaluate( (datosArticulo) => {
                let articleDataHTML = document.querySelectorAll("#folder1 .opened .line span:nth-child(2):not(.html-attribute-value)")
                let articleTypeDataHTML = document.querySelectorAll("#folder1 .opened .line > span:first-child")

                for(let z = 0; z < articleDataHTML.length; z++){
                    if(articleTypeDataHTML[z].innerText.includes("author")){
                        datosArticulo.authors.push(articleDataHTML[z].innerText)
                    }else if(articleTypeDataHTML[z].innerText.includes("pages")){
                        datosArticulo.pages = articleDataHTML[z].innerText;
                    }else if(articleTypeDataHTML[z].innerText.includes("year")){
                        datosArticulo.year = articleDataHTML[z].innerText;
                    }else if(articleTypeDataHTML[z].innerText.includes("booktitle")){
                        datosArticulo.book_title = articleDataHTML[z].innerText;
                    }else if(articleTypeDataHTML[z].innerText.includes("title")){
                        datosArticulo.title = articleDataHTML[z].innerText;
                    }
                }
                return datosArticulo;
            }, datosArticulo)
            datosPublicaciones.push(extraerInfoXML);
             //en este for hay que abrir nuevas pestañas al navegador y mandarlas a otras webs para calcular algunos indices que se basan en el acronimo de los articulos
        }

        for(let j = 0; j < results.incollection.length; j++){
            datosArticulo = { type : "incollection", authors: [], issue: null}
            await page.goto(results.incollection[j], {waitUntil: "networkidle2"})
            let extraerInfoXML = await page.evaluate( (datosArticulo) => {
                let articleDataHTML = document.querySelectorAll("#folder1 .opened .line span:nth-child(2):not(.html-attribute-value)")
                let articleTypeDataHTML = document.querySelectorAll("#folder1 .opened .line > span:first-child")

                for(let z = 0; z < articleDataHTML.length; z++){
                    if(articleTypeDataHTML[z].innerText.includes("author")){
                        datosArticulo.authors.push(articleDataHTML[z].innerText)
                    }else if(articleTypeDataHTML[z].innerText.includes("pages")){
                        datosArticulo.pages = articleDataHTML[z].innerText;
                    }else if(articleTypeDataHTML[z].innerText.includes("year")){
                        datosArticulo.year = articleDataHTML[z].innerText;
                    }else if(articleTypeDataHTML[z].innerText.includes("booktitle")){
                        datosArticulo.book_title = articleDataHTML[z].innerText;
                    }else if(articleTypeDataHTML[z].innerText.includes("title")){
                        datosArticulo.title = articleDataHTML[z].innerText;
                    }
                }
                return datosArticulo;
            }, datosArticulo)
            datosPublicaciones.push(extraerInfoXML);
             //en este for hay que abrir nuevas pestañas al navegador y mandarlas a otras webs para calcular algunos indices que se basan en el acronimo de los articulos
        }
    console.log(datosPublicaciones)
    console.log("hay " + results.articles.length + " articulos")
    console.log("hay " + results.inproceedings.length + " inproceedings")
    console.log("hay " + results.incollection.length + " incollection")
    
        /*Controlar si este articulo ya esta incluido en el array datosPublicaciones, ejemplo si nos dan dos autores de los cuales extraer info
        y adrian y verdejo han participado en el mismo articulo, cuando procesas adrian por primera vez lo incluyes, pero cuando procesas a verdejo
        ese articulo ya esta incluido, por lo que no se debe incluir otra vez pero si lo debes usar para calcular los indices de verdejo y demas*/
        
        datosAutores.push(datosAutor)
    }
    let finalResult = {
        "authors": datosAutores,
        "publications": datosPublicaciones
    }
    res.json(finalResult)
}

async function autoScroll(page){
    await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
            var totalHeight = 0;
            var distance = 100;
            var timer = setInterval(() => {
                var scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if(totalHeight >= scrollHeight){
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}