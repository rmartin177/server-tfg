const path = require("path")
const fs = require("fs")
const { performance } = require('perf_hooks');
const stringHelper = require("../utils/stringHelper")
const scrappingHelper = require("../utils/scrappingHelper")
const excelGGS = require("../utils/excelHelper");
const { table } = require("console");
const { send } = require("process");
//Refactorizar esta funcion en otras mas pequeñas

exports.getJSON = async (req, res) => {
    let authors = req.body;
    console.log(authors)
    let page = await res.locals.browser.newPage();
    let scrapping = new scrappingHelper();
    await scrapping.optimizationWeb(page);
    let haveHomonymsAndLinks = await checkCorrectAuthors(page, authors)
    if(haveHomonymsAndLinks.haveHomonyms){
        await page.close();
        res.send(haveHomonymsAndLinks.authors)
    }
    else{
        await page.close();
        let authorsLinkAndName = []
        for(let i = 0; i < haveHomonymsAndLinks.authors.length; i++){
            authorsLinkAndName.push(haveHomonymsAndLinks.authors[i].authors[0])
        }
        let result = await getAllData(authorsLinkAndName, res.locals.browser);
        res.json(result)
    }
}

exports.getJSONsanitize = async (req, res) => {
    let authors = req.body;
    let result = await getAllData(authors, res.locals.browser);
    res.json(result)
}

async function getAllData(authors, browser){
    console.log(authors)
    let page = await browser.newPage();
    let ggs = new excelGGS();
    let scrapping = new scrappingHelper();
    await scrapping.optimizationWeb(page);
    let AuthorsData = [], publicationsData = []; //arrays donde meteremos los datos extraidos de cada autor y publicaciones, resultado final a procesar
    for (let i = 0; i < authors.length; i++) {
        //este objeto se completa durante la iteracion del for y se introduce en el array de autores
        let checkAndBibtexAndName = await goToXML(page, authors[i].link)
        let authorData = initAuthor(authors[i].author)
        let checkName = checkAndBibtexAndName.checkName;
        let authorsChecking = {
            authors: AuthorsData,
            actualPosition: i
        }
        let publications = await page.evaluate((checkName, authorsChecking) => {
            let valuesHTML = null, fullHTML = null;
            if (checkName) {
                //Si hay dos con el mismo nombre el XML cambia, debe usar estos selectores
                fullHTML = document.querySelectorAll("#folder0  > .opened  > .folder:not(#folder2) .opened .folder:first-child .line > span:first-child");
                valuesHTML = document.querySelectorAll("#folder0  > .opened  > .folder:not(#folder2) .opened .folder:first-child .line span:nth-child(2):not(.html-attribute-value):not(.html-attribute)")
            } else { //Estos son los estandard para el 99.9%
                valuesHTML = document.querySelectorAll("#folder0  > .opened  > .folder .opened .folder:first-child .line span:nth-child(2):not(.html-attribute-value):not(.html-attribute)")
                fullHTML = document.querySelectorAll("#folder0  > .opened  > .folder .opened .folder:first-child .line > span:first-child");
            }
            let doc = { authors: [] }, checkIfIsInformal = false, contValues = 0;
            let publicationsDataAux = {
                inproceedings: [],
                articles: [],
                incollections: [],
                duplicateArticles: [],
                duplicateInproceedings: [],
                duplicateIncollections: []
            };
            for (let j = 0; j < fullHTML.length; j++) {
                if (fullHTML[j].className == "folder-button fold") { //Inicio de un articulo nuevo, procedemos a cargar el antiguo y resetear el objeto que lo lee
                    if (!checkIfIsInformal && j > 0) {
                        let checkArticle = false;
                        for (let x = 0; x < authorsChecking.actualPosition && !checkArticle; x++) {
                            for (let z = 0; z < doc.authors.length && !checkArticle; z++) {
                                if (authorsChecking.authors[x].name.includes(doc.authors[z])) {
                                    checkArticle = true;
                                }
                            }
                        }
                        if (!checkArticle) {
                            if (doc.type === "Inproceedings") {
                                publicationsDataAux.inproceedings.push(doc)
                            } else if (doc.type === "Incollection") {
                                publicationsDataAux.incollections.push(doc)
                            } else if (doc.type === "Articles") {
                                publicationsDataAux.articles.push(doc)
                            }
                        } else {
                            if (doc.type === "Inproceedings") {
                                publicationsDataAux.duplicateInproceedings.push(doc)
                            } else if (doc.type === "Incollection") {
                                publicationsDataAux.duplicateIncollections.push(doc)
                            } else if (doc.type === "Articles") {
                                publicationsDataAux.duplicateArticles.push(doc)
                            }
                        }
                    }
                    doc = { authors: [] }; checkIfIsInformal = false;
                    if (valuesHTML[contValues].innerText.includes("informal")) checkIfIsInformal = true;
                    else if (valuesHTML[contValues].innerText.includes("inproceedings")) doc.type = "Inproceedings";
                    else if (valuesHTML[contValues].innerText.includes("article")) doc.type = "Articles";
                    else if (valuesHTML[contValues].innerText.includes("incollection")) doc.type = "Incollection";
                } else {
                    if (fullHTML[j].innerText.includes("</")) {
                        contValues--;
                    } else if (fullHTML[j].innerText.includes("author")) {
                        doc.authors.push(valuesHTML[contValues].innerText)
                    } else if (fullHTML[j].innerText.includes("booktitle")) {
                        doc.acronym = valuesHTML[contValues].innerText;
                    } else if (fullHTML[j].innerText.includes("title")) {
                        doc.title = valuesHTML[contValues].innerText;
                    } else if (fullHTML[j].innerText.includes("pages")) {
                        doc.pages = valuesHTML[contValues].innerText;
                    } else if (fullHTML[j].innerText.includes("year")) {
                        doc.year = valuesHTML[contValues].innerText;
                    } else if (fullHTML[j].innerText.includes("volume")) {
                        doc.volume = valuesHTML[contValues].innerText;
                    } else if (fullHTML[j].innerText.includes("journal")) {
                        doc.journal = valuesHTML[contValues].innerText;
                    } else if (fullHTML[j].innerText.includes("number")) {
                        doc.issue = valuesHTML[contValues].innerText;
                    }
                }
                contValues++;
            }
            if (!checkIfIsInformal) {
                let checkArticle = false;
                for (let x = 0; x < authorsChecking.actualPosition && !checkArticle; x++) {
                    for (let z = 0; z < doc.authors.length && !checkArticle; z++) {
                        if (authorsChecking.authors[x].name.includes(doc.authors[z])) {
                            checkArticle = true;
                        }
                    }
                }
                if (!checkArticle) {
                    if (doc.type === "Inproceedings") {
                        publicationsDataAux.inproceedings.push(doc)
                    } else if (doc.type === "Incollection") {
                        publicationsDataAux.incollections.push(doc)
                    } else if (doc.type === "Articles") {
                        publicationsDataAux.articles.push(doc)
                    }
                }
            }
            return publicationsDataAux;
        }, checkName, authorsChecking)

        let book_titles = await getBooktitles(page, checkAndBibtexAndName.bibtex)
        await countGGSandCore(publications.inproceedings, ggs,authorData, book_titles, page)
        await countGGSandCore(publications.duplicateInproceedings,ggs,authorData, book_titles, page)
        publicationsData = publications.incollections.concat(publicationsData)
        publicationsData = publications.inproceedings.concat(publicationsData)
        publicationsData = publications.articles.concat(publicationsData)
        AuthorsData.push(authorData)
    }
    await page.close()
    return {
        authors: AuthorsData,
        publications: publicationsData
    }

}


async function countGGSandCore(publications, ggs, authorData, book_titles, page){
    for (let i = 0; i < publications.length; i++) {
        if (publications[i].acronym !== null) {
            publications[i].book_title = book_titles[i]
            publications[i].ggs = ggs.filterGGSperYear(publications[i].acronym, publications[i].year)
            if(publications[i].ggs.class == 1) authorData.ggs.numero_publicaciones_class_1++;
            else if(publications[i].ggs.class == 2) authorData.ggs.numero_publicaciones_class_2++;
            else if(publications[i].ggs.class == 3) authorData.ggs.numero_publicaciones_class_3++;
            //From this point the core code starts
            let link = "http://portal.core.edu.au/conf-ranks/?search=" + publications[i].acronym + "&by=all&source=all&sort=atitle&page=1";
            await page.goto(link, { waitUntil: "networkidle2" })
            let example = await page.evaluate( (acronym) => {
                let tableData = document.querySelectorAll("tr td:nth-child(2)");
                for(let j = 0; j < tableData.length; j++){
                    if(tableData[j].innerText == acronym) return "table tr:nth-child(" + (j+2)+ ") td:first-child"
                }
                return null;
            }, publications[i].acronym)
            if(example !== null){
                await page.click(example)
                await page.waitForSelector("#detail")
                let core = await page.evaluate( (year)=> {
                    let coreHTML = document.querySelectorAll(".detail div:first-child")
                    let rankHTML = document.querySelectorAll(".detail div:nth-child(2)")
                    for(let i = 2; i < coreHTML.length; i++){
                        let rank = rankHTML[i-2].innerText.substring(6), core = null;
                        if(coreHTML[i].innerText.includes("ERA")) core = coreHTML[i].innerText.substring(11)
                        else core = coreHTML[i].innerText.substring(12)
                        if(core <= year || coreHTML.length == (i+1)){
                            return {
                                core_year: core,
                                core_category: rank
                            }
                        }
                    }
                    return null;
                },publications[i].year)
                publications[i].core = core;
                if(publications[i].core.core_category === "A*")authorData.core.numero_publicaciones_AA++;
                else if(publications[i].core.core_category === "A")authorData.core.numero_publicaciones_A++;
                else if(publications[i].core.core_category === "B")authorData.core.numero_publicaciones_B++;
                else if(publications[i].core.core_category === "C")authorData.core.numero_publicaciones_C++;
            }else publications[i].core = {
                core_year: null,
                core_category: null /* Si no tiene ranking CORE, ambos a null */
            }
        }
    }
}

async function checkCorrectAuthors(page, authors){
    let linkToAuthor = [], homonyms = false;
    for(let i = 0; i < authors.length; i++){
        await page.goto("https://dblp.org/", { waitUntil: "networkidle2" })
        await page.type('input[type="search"]', authors[i])
        await page.keyboard.press("Enter");
        await page.waitForSelector("#completesearch-authors");
        //sameName sirve para ver si hay un selector homonimo (por si dos personas se llaman igual vamos, solo vi el caso de adrian riesco pero cambia toda la cabecera de su XML)
        let link = await page.evaluate(() => {
            let result = {authors: []}
            let namesAndLinks = document.querySelectorAll("#completesearch-authors ul.result-list li a")
            for(let j = 0; j < namesAndLinks.length; j++){
                result.authors.push(
                    {
                        author: namesAndLinks[j].innerText, 
                        link: namesAndLinks[j].href
                    }
                )
            }
            return result;
        })
        if(link.authors.length > 1)homonyms = true
        linkToAuthor.push(link)
    }
    return {
        authors: linkToAuthor,
        haveHomonyms: homonyms
    }
}


async function goToXML(page, link) {
    //sameName sirve para ver si hay un selector homonimo (por si dos personas se llaman igual vamos, solo vi el caso de adrian riesco pero cambia toda la cabecera de su XML)
    let sameName; checkName = true;
    await page.goto(link, { waitUntil: "networkidle2" })
    try {
        sameName = await page.waitForSelector("#homonyms", { timeout: 1000 });
    } catch (e) {
        sameName = null;
    }
    //Como sameName no lo puedo mandar como parametro luego (si haces console log tiene un valor raro si no es null) uso checkName
    if (sameName === null) checkName = false;
    await page.waitForSelector("#headline");
    let linkToDataAndName = await page.evaluate(() => {
        let links = {}
        links.xml = document.querySelector("#headline .export .body ul li:nth-child(5) a").href;
        links.bibtex = document.querySelector("#headline .export .body ul li:nth-child(1) a").href;
        return links;
    })
    await page.goto(linkToDataAndName.xml, { waitUntil: "networkidle2" })
    let checking = {
        bibtex: linkToDataAndName.bibtex,
        checkName: checkName,
    }
    return checking;
}

async function getBooktitles(page, bibtex) {
    await page.goto(bibtex, { waitUntil: "networkidle2" })
    return await page.evaluate(() => {
        let book_titles = []
        let data = document.querySelectorAll(".verbatim.select-on-click"), checking = false, article = null;
        for (let i = 0; i < data.length; i++) {
            if (data[i].innerText.includes("booktitle =")) {
                article = data[i].innerText.split("},");
                let book_title = article[3].substring(16).trim().replace(/(\r\n|\n|\r)/gm, " ")
                    .replace("                ", " ")
                    .replace("                ", " ")
                    .replace("                ", " ")
                    .replace("                ", " ")
                book_titles.push(book_title)
            }
        }
        return book_titles;
    })
}

function initAuthor(name){
    return  {
        name: name,
        indices: {
            indice_h_total_google_scholar: 0,
            indice_h_5_years_google_scholar: 0,
            indice_i10_total_google_scholar: 0,
            indice_i10_5_years_google_scholar: 0,
            indice_h_total_scopus: 0
        },
        citas: {
            citas_total_google_scholar: 0,
            citas_total_5_years_google_scholar: 0,
            citas_total_scopus: 0
        },
        jcr: {
            numero_publicaciones_q1: 0,
            numero_publicaciones_q2: 0,
            numero_publicaciones_q3: 0,
            numero_publicaciones_q4: 0
        },
        ggs: {
            numero_publicaciones_class_1: 0,
            numero_publicaciones_class_2: 0,
            numero_publicaciones_class_3: 0
        },
        core: {
            numero_publicaciones_AA: 0,
            numero_publicaciones_A: 0,
            numero_publicaciones_B: 0,
            numero_publicaciones_C: 0
        }
    }
}