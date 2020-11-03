const path = require("path")
const fs = require("fs")
const { performance } = require('perf_hooks');
const stringHelper = require("../utils/stringHelper")
const scrappingHelper = require("../utils/scrappingHelper")
const excelCORE2018 = require("../utils/excelHelper")
//Refactorizar esta funcion en otras mas pequeñas
exports.getJSON = async (req, res) => {
    let authors = req.body;
    console.log(authors)
    let page = await res.locals.browser.newPage();
    let core2018 = new excelCORE2018();
    let scrapping = new scrappingHelper();
    await scrapping.optimizationWeb(page);
    let AuthorsData = [], publicationsData = []; //arrays donde meteremos los datos extraidos de cada autor y publicaciones, resultado final a procesar
    for (let i = 0; i < authors.length; i++) {
        //este objeto se completa durante la iteracion del for y se introduce en el array de autores
        let autorData = {
            "name": authors[i]
        }
        let checkName = await goToXML(page, authors[i])
        let publications = await page.evaluate( (checkName) => {
            let valuesHTML = null, fullHTML = null; 
            if(checkName){
                //Si hay dos con el mismo nombre el XML cambia, debe usar estos selectores
                fullHTML = document.querySelectorAll("#folder0  > .opened  > .folder:not(#folder2) .opened .folder:first-child .line > span:first-child");
                valuesHTML = document.querySelectorAll("#folder0  > .opened  > .folder:not(#folder2) .opened .folder:first-child .line span:nth-child(2):not(.html-attribute-value):not(.html-attribute)")
            }else{ //Estos son los estandard para el 99.9%
                valuesHTML = document.querySelectorAll("#folder0  > .opened  > .folder .opened .folder:first-child .line span:nth-child(2):not(.html-attribute-value):not(.html-attribute)")
                fullHTML = document.querySelectorAll("#folder0  > .opened  > .folder .opened .folder:first-child .line > span:first-child");
            }
            let doc = { authors : []}, checkIfIsInformal = false, contValues = 0;
            let publicationsDataAux = {
                inproceedings: [],
                articles: [],
                incollections: []
            }; 
            for (let i = 0; i < fullHTML.length; i++) {
                if (fullHTML[i].className == "folder-button fold") { //Inicio de un articulo nuevo, procedemos a cargar el antiguo y resetear el objeto que lo lee
                    if(!checkIfIsInformal && i > 0) {
                        if(doc.type === "Inproceedings"){
                            if(doc.book_title !== null){
                                let linkToCORE = "http://portal.core.edu.au/conf-ranks/?search=" + doc.book_title + "&by=acronym&source=all&sort=atitle&page=1"
                                /* await page.goto(linkToCORE, { waitUntil: "networkidle2" })*/
                                publicationsDataAux.inproceedings.push(doc)
                        }
                        }else if(doc.type === "Incollection"){
                            publicationsDataAux.incollections.push(doc)
                        }else if(doc.type === "Articles"){
                            publicationsDataAux.articles.push(doc)
                        }
                    }
                    doc = { authors : []}; checkIfIsInformal = false;
                    if (valuesHTML[contValues].innerText.includes("informal")) checkIfIsInformal = true;
                    else if (valuesHTML[contValues].innerText.includes("inproceedings")) doc.type = "Inproceedings";
                    else if (valuesHTML[contValues].innerText.includes("article")) doc.type = "Articles";
                    else if (valuesHTML[contValues].innerText.includes("incollection")) doc.type = "Incollection";
                } else {
                    if(fullHTML[i].innerText.includes("</")){
                        contValues--;
                    }else if (fullHTML[i].innerText.includes("author")) {
                        doc.authors.push(valuesHTML[contValues].innerText)
                    } else if (fullHTML[i].innerText.includes("booktitle")) {
                        doc.book_title = valuesHTML[contValues].innerText;
                    } else if (fullHTML[i].innerText.includes("title")) {
                        doc.title = valuesHTML[contValues].innerText;
                    } else if (fullHTML[i].innerText.includes("pages")) {
                        doc.pages = valuesHTML[contValues].innerText;
                    } else if (fullHTML[i].innerText.includes("year")) {
                        doc.year = valuesHTML[contValues].innerText;
                    } else if (fullHTML[i].innerText.includes("volume")) {
                        doc.volume = valuesHTML[contValues].innerText;
                    } else if (fullHTML[i].innerText.includes("journal")) {
                        doc.journal = valuesHTML[contValues].innerText;
                    } else if (fullHTML[i].innerText.includes("issue")) {
                        doc.issue = valuesHTML[contValues].innerText;
                    }
                }
                contValues++;
            }
            if(!checkIfIsInformal){
                if(doc.type === "Inproceedings"){
                    publicationsDataAux.inproceedings.push(doc)
                }else if(doc.type === "Incollection"){
                    publicationsDataAux.incollections.push(doc)
                }else if(doc.type === "Articles"){
                    publicationsDataAux.articles.push(doc)
                }
            } 
            return publicationsDataAux;
        }, checkName)

        for(let i = 0; i < publications.inproceedings.length; i++){
            if(publications.inproceedings[i].book_title !== null){
                publications.inproceedings[i].gss = core2018.readExcelCORE2018(publications.inproceedings[i].book_title)
            }
        }

        /*Controlar si este articulo ya esta incluido en el array publicationsData, ejemplo si nos dan dos autores de los cuales extraer info
        y adrian y verdejo han participado en el mismo articulo, cuando procesas adrian por primera vez lo incluyes, pero cuando procesas a verdejo
        ese articulo ya esta incluido, por lo que no se debe incluir otra vez pero si lo debes usar para calcular los indices de verdejo y demas*/
        publicationsData = publications.incollections.concat(publicationsData)
        publicationsData = publications.inproceedings.concat(publicationsData)
        publicationsData = publications.articles.concat(publicationsData)
        AuthorsData.push(autorData)
    }
    /*await page.close()*/
    let finalResult = {
        "authors": AuthorsData,
        "publications": publicationsData
    }
    /*console.log(finalResult)*/
    res.json(finalResult)
}

async function goToXML(page, author){
    await page.goto("https://dblp.org/", { waitUntil: "networkidle2" })
    await page.type('input[type="search"]', author)
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);
    //sameName sirve para ver si hay un selector homonimo (por si dos personas se llaman igual vamos, solo vi el caso de adrian riesco pero cambia toda la cabecera de su XML)
    let sameName; checkName = true;
    let link = await page.evaluate(() => {
        return document.querySelector("#completesearch-authors ul.result-list li a").href; //controlar mas adelante usuarios con mismo nombre
    })
    page.goto(link, { waitUntil: "networkidle2" })
    try{
        sameName =  await page.waitForSelector("#homonyms", {timeout: 1000});
    }catch(e){
        sameName = null;
    }
    //Como sameName no lo puedo mandar como parametro luego (si haces console log tiene un valor raro si no es null) uso checkName
    if(sameName === null) checkName = false;
    const linkToData = await page.evaluate(() => {
        return document.querySelector("#headline .export .body ul li:nth-child(5) a").href;
    })
    await page.goto(linkToData, { waitUntil: "networkidle2" })
    return checkName;
}





/*   CODIGO VIEJO QUE ENTRABA ARTICULO POR ARTICULO EN EL XML, LO DEJO AQUI POR SI POR CUALQUIER COSA LO NECESITASE RESCATAR

        const results = await page.evaluate(() => {
            let articlesParse = [], inproceedingsParse = [], incollectionParse = [];
            let articles = document.querySelectorAll(".entry.article nav.publ ul li:nth-child(2) div.body ul li:nth-child(5) a");
            let inproceedings = document.querySelectorAll(".entry.inproceedings nav.publ ul li:nth-child(2) div.body ul li:nth-child(5) a");
            let incollection = document.querySelectorAll(".entry.incollection nav.publ ul li:nth-child(2) div.body ul li:nth-child(5) a");
            let results = {};
            for (let i = 0; i < articles.length; i++) {
                articlesParse.push(articles[i].href)
            }
            for (let i = 0; i < inproceedings.length; i++) {
                inproceedingsParse.push(inproceedings[i].href)
            }
            for (let i = 0; i < incollection.length; i++) {
                incollectionParse.push(incollection[i].href)
            }
            results.articles = articlesParse;
            results.inproceedings = inproceedingsParse;
            results.incollection = incollectionParse;
            return results;
        })
        //Una vez tienes el 100% de enlaces de la web hacia los XML, procedemos a ir a ellos y extraer la info para completar los arrays
        for (let j = 0; j < results.articles.length; j++) {
            datosArticulo = { type: "article", authors: [], issue: null }
            await page.goto(results.articles[j], { waitUntil: "networkidle2" })
            let extraerInfoXML = await page.evaluate((datosArticulo) => {
                let articleDataHTML = document.querySelectorAll("#folder1 .opened .line span:nth-child(2):not(.html-attribute-value)")
                let articleTypeDataHTML = document.querySelectorAll("#folder1 .opened .line > span:first-child")

                for (let z = 0; z < articleDataHTML.length; z++) {
                    if (articleTypeDataHTML[z].innerText.includes("author")) {
                        datosArticulo.authors.push(articleDataHTML[z].innerText)
                    } else if (articleTypeDataHTML[z].innerText.includes("booktitle")) {
                        datosArticulo.book_title = articleDataHTML[z].innerText;
                    } else if (articleTypeDataHTML[z].innerText.includes("title")) {
                        datosArticulo.title = articleDataHTML[z].innerText;
                    } else if (articleTypeDataHTML[z].innerText.includes("pages")) {
                        datosArticulo.pages = articleDataHTML[z].innerText;
                    } else if (articleTypeDataHTML[z].innerText.includes("year")) {
                        datosArticulo.year = articleDataHTML[z].innerText;
                    } else if (articleTypeDataHTML[z].innerText.includes("volume")) {
                        datosArticulo.volume = articleDataHTML[z].innerText;
                    } else if (articleTypeDataHTML[z].innerText.includes("journal")) {
                        datosArticulo.journal = articleDataHTML[z].innerText;
                    } else if (articleTypeDataHTML[z].innerText.includes("issue")) {
                        datosArticulo.issue = articleDataHTML[z].innerText;
                    }
                }
                return datosArticulo;
            }, datosArticulo)
    
           
        
        publicationsData.push(extraerInfoXML);
        //en este for hay que abrir nuevas pestañas al navegador y mandarlas a otras webs para calcular algunos indices que se basan en el acronimo de los articulos
    }

    for (let j = 0; j < results.inproceedings.length; j++) {
        datosArticulo = { type: "inproceeding", authors: [] }
        await page.goto(results.inproceedings[j], { waitUntil: "networkidle2" })
        let extraerInfoXML = await page.evaluate((datosArticulo) => {
            let articleDataHTML = document.querySelectorAll("#folder1 .opened .line span:nth-child(2):not(.html-attribute-value)")
            let articleTypeDataHTML = document.querySelectorAll("#folder1 .opened .line > span:first-child")

            for (let z = 0; z < articleDataHTML.length; z++) {
                if (articleTypeDataHTML[z].innerText.includes("author")) {
                    datosArticulo.authors.push(articleDataHTML[z].innerText)
                } else if (articleTypeDataHTML[z].innerText.includes("pages")) {
                    datosArticulo.pages = articleDataHTML[z].innerText;
                } else if (articleTypeDataHTML[z].innerText.includes("year")) {
                    datosArticulo.year = articleDataHTML[z].innerText;
                } else if (articleTypeDataHTML[z].innerText.includes("booktitle")) {
                    datosArticulo.book_title = articleDataHTML[z].innerText;
                } else if (articleTypeDataHTML[z].innerText.includes("title")) {
                    datosArticulo.title = articleDataHTML[z].innerText;
                }
            }
            return datosArticulo;
        }, datosArticulo)
        publicationsData.push(extraerInfoXML);
        //en este for hay que abrir nuevas pestañas al navegador y mandarlas a otras webs para calcular algunos indices que se basan en el acronimo de los articulos
    }

    for (let j = 0; j < results.incollection.length; j++) {
        datosArticulo = { type: "incollection", authors: [], issue: null }
        await page.goto(results.incollection[j], { waitUntil: "networkidle2" })
        let extraerInfoXML = await page.evaluate((datosArticulo) => {
            let articleDataHTML = document.querySelectorAll("#folder1 .opened .line span:nth-child(2):not(.html-attribute-value)")
            let articleTypeDataHTML = document.querySelectorAll("#folder1 .opened .line > span:first-child")

            for (let z = 0; z < articleDataHTML.length; z++) {
                if (articleTypeDataHTML[z].innerText.includes("author")) {
                    datosArticulo.authors.push(articleDataHTML[z].innerText)
                } else if (articleTypeDataHTML[z].innerText.includes("pages")) {
                    datosArticulo.pages = articleDataHTML[z].innerText;
                } else if (articleTypeDataHTML[z].innerText.includes("year")) {
                    datosArticulo.year = articleDataHTML[z].innerText;
                } else if (articleTypeDataHTML[z].innerText.includes("booktitle")) {
                    datosArticulo.book_title = articleDataHTML[z].innerText;
                } else if (articleTypeDataHTML[z].innerText.includes("title")) {
                    datosArticulo.title = articleDataHTML[z].innerText;
                }
            }
            return datosArticulo;
        }, datosArticulo)
        publicationsData.push(extraerInfoXML);
        //en este for hay que abrir nuevas pestañas al navegador y mandarlas a otras webs para calcular algunos indices que se basan en el acronimo de los articulos
    }*/