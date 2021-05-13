const path = require("path");
const fs = require("fs");
const { performance } = require("perf_hooks");
const scrappingHelper = require("../utils/scrappingHelper");
const excelGGS = require("../utils/excelHelper");
const { send } = require("process");

//Refactorizar esta funcion en otras mas pequeñas

exports.getJSON = async (req, res) => {
  let { authors, filters } = req.body;
  console.log(authors);
  console.log(filters);
  let page = await res.locals.browser.newPage();
  let scrapping = new scrappingHelper();
  await scrapping.optimizationWeb(page);
  let haveHomonymsAndLinks = await checkCorrectAuthors(page, authors);
  console.log(haveHomonymsAndLinks);
  if (haveHomonymsAndLinks.haveHomonyms || haveHomonymsAndLinks.errors) {
    await page.close();
    res.send(haveHomonymsAndLinks.authors);
  } else {
    await page.close();
    let authorsLinkAndName = [];
    for (let i = 0; i < haveHomonymsAndLinks.authors.length; i++) {
      authorsLinkAndName.push(haveHomonymsAndLinks.authors[i].authors[0]);
    }
    let result = await getAllData(
      authorsLinkAndName,
      res.locals.browser,
      res.locals.dataCore,
      filters
    );
    res.json(result);
  }
};

exports.getJSONsanitize = async (req, res) => {
  let { authors, filters } = req.body;
  console.log(req.body);
  let result = await getAllData(
    authors,
    res.locals.browser,
    res.locals.dataCore,
    filters
  );
  res.json(result);
};

async function getAllData(authors, browser, dataCore, filters) {
  console.log(authors);
  let page = await browser.newPage();
  let ggs = new excelGGS();
  let scrapping = new scrappingHelper();
  await scrapping.optimizationWeb(page);
  let AuthorsData = [],
    publicationsData = []; //arrays donde meteremos los datos extraidos de cada autor y publicaciones, resultado final a procesar
  for (let i = 0; i < authors.length; i++) {
    //este objeto se completa durante la iteracion del for y se introduce en el array de autores
    let checkAndBibtexAndName = await goToXML(page, authors[i].link);
    let authorData = initAuthor(authors[i].author);
    authorData.orcid = "";
    let checkName = checkAndBibtexAndName.checkName;
    let authorsChecking = {
      authors: AuthorsData,
      actualPosition: i,
    };
    let publications = await page.evaluate(
      (checkName, authorsChecking, filter) => {
        let valuesHTML = null,
          fullHTML = null,
          orcid = null;
        if (checkName) {
          //Si hay dos con el mismo nombre el XML cambia, debe usar estos selectores
          fullHTML = document.querySelectorAll(
            "#folder0  > .opened  > .folder:not(#folder2) .opened .folder:first-child .line > span:first-child"
          );
          valuesHTML = document.querySelectorAll(
            "#folder0  > .opened  > .folder:not(#folder2) .opened .folder:first-child .line span:nth-child(2):not(.html-attribute-value):not(.html-attribute)"
          );
          orcid = document.querySelector("url").innerHTML;
        } else {
          //Estos son los estandard para el 99.9%
          valuesHTML = document.querySelectorAll(
            "#folder0  > .opened  > .folder .opened .folder:first-child .line span:nth-child(2):not(.html-attribute-value):not(.html-attribute)"
          );
          fullHTML = document.querySelectorAll(
            "#folder0  > .opened  > .folder .opened .folder:first-child .line > span:first-child"
          );
          orcid = document.querySelector("url").innerHTML;
        }
        let doc = { authors: [] },
          checkIfIsInformal = false,
          contValues = 0;
        let publicationsDataAux = {
          inproceedings: [],
          articles: [],
          incollections: [],
          duplicateArticles: [],
          duplicateInproceedings: [],
          duplicateIncollections: [],
          orcid: "",
        };
        if (orcid.includes("orcid"))
          publicationsDataAux.orcid = orcid.slice(18);
        for (let j = 0; j < fullHTML.length; j++) {
          if (fullHTML[j].className == "folder-button fold") {
            //Inicio de un articulo nuevo, procedemos a cargar el antiguo y resetear el objeto que lo lee
            if (!checkIfIsInformal && j > 0) {
              let checkArticle = false;
              for (
                let x = 0;
                x < authorsChecking.actualPosition && !checkArticle;
                x++
              ) {
                for (let z = 0; z < doc.authors.length && !checkArticle; z++) {
                  if (
                    authorsChecking.authors[x].name.includes(doc.authors[z])
                  ) {
                    checkArticle = true;
                  }
                }
              }
              if (!checkArticle) {
                if (
                  doc.type === "Inproceedings" &&
                  filter.checkInproceedings &&
                  doc.year >= filter.initYear &&
                  doc.year <= filter.endYear
                ) {
                  publicationsDataAux.inproceedings.push(doc);
                } else if (
                  doc.type === "Incollection" &&
                  filter.checkIncollections &&
                  doc.year >= filter.initYear &&
                  doc.year <= filter.endYear
                ) {
                  publicationsDataAux.incollections.push(doc);
                } else if (
                  doc.type === "Articles" &&
                  filter.checkArticles &&
                  doc.year >= filter.initYear &&
                  doc.year <= filter.endYear
                ) {
                  publicationsDataAux.articles.push(doc);
                }
              } else {
                if (
                  doc.type === "Inproceedings" &&
                  filter.checkInproceedings &&
                  doc.year >= filter.initYear &&
                  doc.year <= filter.endYear
                ) {
                  publicationsDataAux.duplicateInproceedings.push(doc);
                } else if (
                  doc.type === "Incollection" &&
                  filter.checkIncollections &&
                  doc.year >= filter.initYear &&
                  doc.year <= filter.endYear
                ) {
                  publicationsDataAux.duplicateIncollections.push(doc);
                } else if (
                  doc.type === "Articles" &&
                  filter.checkArticles &&
                  doc.year >= filter.initYear &&
                  doc.year <= filter.endYear
                ) {
                  publicationsDataAux.duplicateArticles.push(doc);
                }
              }
            }
            doc = { authors: [] };
            checkIfIsInformal = false;
            if (valuesHTML[contValues].innerText.includes("informal"))
              checkIfIsInformal = true;
            else if (valuesHTML[contValues].innerText.includes("inproceedings"))
              doc.type = "Inproceedings";
            else if (valuesHTML[contValues].innerText.includes("article"))
              doc.type = "Articles";
            else if (valuesHTML[contValues].innerText.includes("incollection"))
              doc.type = "Incollection";
          } else {
            if (fullHTML[j].innerText.includes("</")) {
              contValues--;
            } else if (fullHTML[j].innerText.includes("author")) {
              doc.authors.push(valuesHTML[contValues].innerText);
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
            } else if (fullHTML[j].innerText.includes("url")) {
              doc.url = valuesHTML[contValues].innerText;
            }
          }
          contValues++;
        }
        if (!checkIfIsInformal) {
          let checkArticle = false;
          for (
            let x = 0;
            x < authorsChecking.actualPosition && !checkArticle;
            x++
          ) {
            for (let z = 0; z < doc.authors.length && !checkArticle; z++) {
              if (authorsChecking.authors[x].name.includes(doc.authors[z])) {
                checkArticle = true;
              }
            }
          }
          if (!checkArticle) {
            if (
              doc.type === "Inproceedings" &&
              filter.checkInproceedings &&
              doc.year >= filter.initYear &&
              doc.year <= filter.endYear
            ) {
              publicationsDataAux.inproceedings.push(doc);
            } else if (
              doc.type === "Incollection" &&
              filter.checkIncollections &&
              doc.year >= filter.initYear &&
              doc.year <= filter.endYear
            ) {
              publicationsDataAux.incollections.push(doc);
            } else if (
              doc.type === "Articles" &&
              filter.checkArticles &&
              doc.year >= filter.initYear &&
              doc.year <= filter.endYear
            ) {
              publicationsDataAux.articles.push(doc);
            }
          }
        }
        return publicationsDataAux;
      },
      checkName,
      authorsChecking,
      filters
    );

    let book_titles = await getBooktitles(page, checkAndBibtexAndName.bibtex);
    if (filters.checkGGS || filters.checkCore)
      await countGGSandCore(
        publications.inproceedings,
        ggs,
        authorData,
        book_titles,
        page,
        dataCore,
        filters.checkGGS,
        filters.checkCore
      );
    if (filters.checkGGS || filters.checkCore)
      await countGGSandCore(
        publications.duplicateInproceedings,
        ggs,
        authorData,
        book_titles,
        page,
        dataCore,
        filters.checkGGS,
        filters.checkCore
      );
    if (filters.checkSchoolar)
      await googleScholar(
        publications.articles,
        publications.inproceedings,
        publications.incollections,
        authorData,
        page
      );
      if(filters.checkJRC) {
        var errores = [];
        errores = await jcr(publications.articles, authorData, page, browser, filters.mail, filters.pass);
      }
      if(filters.checkScopus){
        if (publications.orcid != "") {
           await scopus(
            publications.articles,
            publications.inproceedings,
            publications.incollections,
            authorData,
            publications.orcid,
            page,
            browser,
            filters.mail,
            filters.pass
          );
        }
      }
    publicationsData = publications.incollections.concat(publicationsData);
    publicationsData = publications.inproceedings.concat(publicationsData);
    publicationsData = publications.articles.concat(publicationsData);
    AuthorsData.push(authorData);
  }
  /*await page.close()*/
  return {
    authors: AuthorsData,
    publications: publicationsData,
    errors: errores
  };
}

async function googleScholar(
  articles,
  inproceedings,
  incollections,
  author,
  page
) {
  await page.goto("https://scholar.google.es/citations?view_op=search_authors");
  //Imput de la busqueda
  let authorGood = author.name.replace(
    /[0-9`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi,
    ""
  );
  console.log("author good: " + authorGood);
  let aaa = await page.url();
  await page.waitForSelector("#gs_hdr_tsi");
  await page.type("#gs_hdr_tsi", authorGood);
  await page.keyboard.press("Enter");
  await page.waitForSelector(".gs_ai_name", { timeout: 3000 });
  const linkAuth = await page.evaluate(() => {
    return document.querySelector(".gs_ai_name a").href;
  });
  await page.goto(linkAuth);
  const AllCites = await page.evaluate(() => {
    let cites = document.querySelectorAll(".gsc_rsb_std");
    var result = [];
    for (let i = 0; i < cites.length; i++) {
      result[i] = cites[i].innerText;
    }
    return result;
  });
  //Paso los indices y las citas obtenidas arriba
  author.indices.indice_h_total_google_scholar = AllCites[2];
  author.indices.indice_h_5_years_google_scholar = AllCites[3];
  author.indices.indice_i10_total_google_scholar = AllCites[4];
  author.indices.indice_i10_5_years_google_scholar = AllCites[5];
  author.citas.citas_total_google_scholar = AllCites[0];
  author.citas.citas_total_5_years_google_scholar = AllCites[1];
  //Esperamos a que aparezca el botton shor more
  let botonShowMore;
  try {
    botonShowMore = await page.waitForSelector("#gsc_bpf_more", {
      timeout: 1000,
    });
  } catch (e) {
    botonShowMore = null;
  }

  if (botonShowMore != null) {
    let lol = [];
    //A lo mejor no me va porque no hace scroll hay una funcion en utils.
    const citas = await page.evaluate(async (lol) => {
      async function delay(time) {
        return new Promise(function (resolve) {
          setTimeout(resolve, time);
        });
      }
      let boton = document.querySelector("#gsc_bpf_more:disabled");
      let botonActive = document.querySelector("#gsc_bpf_more");
      console.log("Boton esta en =", boton);

      while (boton === null) {
        //Mirar si esta haciendo click en el boton
        botonActive.click();

        await delay(2000);

        boton = document.querySelector("#gsc_bpf_more:disabled");
      }
      let timer = {};
      timer.scroll = async function scroll() {
        await new Promise((resolve, reject) => {
          var totalHeight = 0;
          var distance = 100;
          var timer = setInterval(() => {
            var scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      };
      await timer.scroll();
      let getDataTitle = document.querySelectorAll(".gsc_a_tr td a.gsc_a_at");
      let getDataCited = document.querySelectorAll(
        ".gsc_a_tr td a.gsc_a_ac.gs_ibl"
      );
      for (let i = 0; i < getDataTitle.length; i++) {
        lol[i] = {};
        lol[i].title = getDataTitle[i].innerText;
        lol[i].cited = getDataCited[i].innerText;
      }
      return lol;
    }, lol);

    //– -
    for (let j = 0; j < articles.length; j++) {
      articles[j].citas = { numero_citas_google_scholar: null };
      let checkFor = false;
      for (let i = 0; i < citas.length && !checkFor; i++) {
        if (
          articles[j].title.toLowerCase().replace("–", "-").replace(".", "") ===
          citas[i].title.toLowerCase().replace("–", "-")
        ) {
          const cite = {
            numero_citas_google_scholar: citas[i].cited,
          };
          if (cite.numero_citas_google_scholar === "")
            cite.numero_citas_google_scholar = "0";
          articles[j].citas = cite;
          checkFor = true;
        }
      }
    }
    for (let j = 0; j < inproceedings.length; j++) {
      inproceedings[j].citas = { numero_citas_google_scholar: null };
      let checkFor = false;
      for (let i = 0; i < citas.length && !checkFor; i++) {
        if (
          inproceedings[j].title
            .toLowerCase()
            .replace("–", "-")
            .replace(".", "") === citas[i].title.toLowerCase().replace("–", "-")
        ) {
          const cite = {
            numero_citas_google_scholar: citas[i].cited,
          };
          if (cite.numero_citas_google_scholar === "")
            cite.numero_citas_google_scholar = "0";
          inproceedings[j].citas = cite;
          checkFor = true;
        }
      }
    }
    for (let j = 0; j < incollections.length; j++) {
      incollections[j].citas = { numero_citas_google_scholar: null };
      let checkFor = false;
      for (let i = 0; i < citas.length && !checkFor; i++) {
        if (
          incollections[j].title
            .toLowerCase()
            .replace("–", "-")
            .replace(".", "") === citas[i].title.toLowerCase().replace("–", "-")
        ) {
          const cite = {
            numero_citas_google_scholar: citas[i].cited,
          };
          if (cite.numero_citas_google_scholar === "")
            cite.numero_citas_google_scholar = "0";
          incollections[j].citas = cite;
          checkFor = true;
        }
      }
    }
  }
}

async function countGGSandCore(
  publications,
  ggs,
  authorData,
  book_titles,
  page,
  dataCore,
  checkGGS,
  checkCore
) {
  for (let i = 0; i < publications.length; i++) {
    if (publications[i].acronym !== null) {
      publications[i].book_title = book_titles[i];
      if (checkGGS) {
        publications[i].ggs = ggs.filterGGSperYear(
          publications[i].acronym,
          publications[i].year
        );
        if (publications[i].ggs.class == 1)
          authorData.ggs.numero_publicaciones_class_1++;
        else if (publications[i].ggs.class == 2)
          authorData.ggs.numero_publicaciones_class_2++;
        else if (publications[i].ggs.class == 3)
          authorData.ggs.numero_publicaciones_class_3++;
      }
      //From this point the core code starts
      if (checkCore) {
        let coreResult = checkAcronym(
          dataCore,
          publications[i].acronym,
          publications[i].year
        ); //funcion checkObjetcCore
        if (coreResult !== null) {
          if (!coreResult) {
            publications[i].core = {
              core_year: null,
              core_category: null /* Si no tiene ranking CORE, ambos a null */,
            };
          } else {
            publications[i].core = coreResult;
            if (publications[i].core.core_category === "A*")
              authorData.core.numero_publicaciones_AA++;
            else if (publications[i].core.core_category === "A")
              authorData.core.numero_publicaciones_A++;
            else if (publications[i].core.core_category === "B")
              authorData.core.numero_publicaciones_B++;
            else if (publications[i].core.core_category === "C")
              authorData.core.numero_publicaciones_C++;
          }
        } else {
          let link =
            "http://portal.core.edu.au/conf-ranks/?search=" +
            publications[i].acronym +
            "&by=all&source=all&sort=atitle&page=1";
          await page.goto(link, { waitUntil: "networkidle2" });
          let example = await page.evaluate((acronym) => {
            let tableData = document.querySelectorAll("tr td:nth-child(2)");
            for (let j = 0; j < tableData.length; j++) {
              if (tableData[j].innerText == acronym)
                return "table tr:nth-child(" + (j + 2) + ") td:first-child";
            }
            return null;
          }, publications[i].acronym);
          if (example !== null) {
            await page.click(example);
            await page.waitForSelector("#detail");
            let coreScrapping = await page.evaluate(
              (year, acronym) => {
                let coreHTML = document.querySelectorAll(
                  ".detail div:first-child"
                );
                let rankHTML = document.querySelectorAll(
                  ".detail div:nth-child(2)"
                );
                let completeAcronym = { acronym: acronym, tableCore: [] },
                  returnAcronym = null;

                let checkCore = false;
                for (let i = 2; i < coreHTML.length && !checkCore; i++) {
                  let rank = rankHTML[i - 2].innerText.substring(6),
                    core = null;
                  if (coreHTML[i].innerText.includes("ERA"))
                    core = coreHTML[i].innerText.substring(11);
                  else core = coreHTML[i].innerText.substring(12);
                  if (acronym === "PPDP") {
                    console.log("valor core: " + core + " valor year: " + year);
                  }
                  if (core <= year || coreHTML.length == i + 1) {
                    returnAcronym = {
                      core_year: core,
                      core_category: rank,
                    };
                    checkCore = true;
                    completeAcronym.tableCore.push({
                      core_year: core,
                      core_category: rank,
                    });
                  }
                }
                completeAcronym.active = true;
                return {
                  completeAcronym,
                  returnAcronym,
                };
              },
              publications[i].year,
              publications[i].acronym
            );
            publications[i].core = coreScrapping.returnAcronym;
            dataCore.push(coreScrapping.completeAcronym);
            if (publications[i].core.core_category === "A*")
              authorData.core.numero_publicaciones_AA++;
            else if (publications[i].core.core_category === "A")
              authorData.core.numero_publicaciones_A++;
            else if (publications[i].core.core_category === "B")
              authorData.core.numero_publicaciones_B++;
            else if (publications[i].core.core_category === "C")
              authorData.core.numero_publicaciones_C++;
          } else {
            publications[i].core = {
              core_year: null,
              core_category: null /* Si no tiene ranking CORE, ambos a null */,
            };
            let completeAcronym = {
              acronym: publications[i].acronym,
              tableCore: [],
              active: false,
            };
            dataCore.push(completeAcronym);
          }
        }
      }
    }
  }
}

async function checkCorrectAuthors(page, authors) {
  let linkToAuthor = [],
    homonyms = false;
    let error = false;
  for (let i = 0; i < authors.length && !error; i++) {
    await page.goto("https://dblp.org/", { waitUntil: "networkidle2" });
    await page.type('input[type="search"]', authors[i]);
    await page.keyboard.press("Enter");
    await page.waitForSelector("#completesearch-authors");
    //sameName sirve para ver si hay un selector homonimo (por si dos personas se llaman igual vamos, solo vi el caso de adrian riesco pero cambia toda la cabecera de su XML)
    console.log("aqui hay un error: ")
    console.log(error)
    try{
      let link = await page.evaluate(() => {
        let result = { authors: [] };
        let namesAndLinks = document.querySelectorAll(
          "#completesearch-authors ul.result-list li"
        );
        for (let j = 0; j < namesAndLinks.length; j++) {
          for (let t = 0; t < namesAndLinks[j].children.length; t++) {
            console.log(namesAndLinks[j].children[t].localName);
            if (namesAndLinks[j].children[t].localName === "a") {
              result.authors.push({
                author: namesAndLinks[j].children[t].innerText,
                link: namesAndLinks[j].children[t].href,
              });
            } else if (namesAndLinks[j].children[t].localName === "small") {
              let data = namesAndLinks[j].children[t].innerText,
                aux = "";
              aux = data.split("\n");
              if (
                !aux[aux.length - 1].includes("aka") &&
                aux[aux.length - 1] !== ""
              ) {
                result.authors[result.authors.length - 1].identified =
                  aux[aux.length - 1];
              }
            }
          }
        }
        return result;
      });
      if (link.authors.length > 1) homonyms = true;
      linkToAuthor.push(link);
  }catch{
    error = true;
  }
}
if(error === true){
  return {errors: "nombre de autor no encontrado"}
}
  /*await page.waitTimeout("300000")*/
  return {
    authors: linkToAuthor,
    haveHomonyms: homonyms,
  };
}

async function goToXML(page, link) {
  //sameName sirve para ver si hay un selector homonimo (por si dos personas se llaman igual vamos, solo vi el caso de adrian riesco pero cambia toda la cabecera de su XML)
  let sameName;
  checkName = true;
  await page.goto(link, { waitUntil: "networkidle2" });
  try {
    sameName = await page.waitForSelector("#homonyms", { timeout: 1000 });
  } catch (e) {
    sameName = null;
  }
  //Como sameName no lo puedo mandar como parametro luego (si haces console log tiene un valor raro si no es null) uso checkName
  if (sameName === null) checkName = false;
  await page.waitForSelector("#headline");
  let linkToDataAndName = await page.evaluate(() => {
    let links = {};
    links.xml = document.querySelector(
      "#headline .export .body ul li:nth-child(5) a"
    ).href;
    links.bibtex = document.querySelector(
      "#headline .export .body ul li:nth-child(1) a"
    ).href;
    return links;
  });
  await page.goto(linkToDataAndName.xml, { waitUntil: "networkidle2" });
  let checking = {
    bibtex: linkToDataAndName.bibtex,
    checkName: checkName,
  };
  return checking;
}

async function getBooktitles(page, bibtex) {
  await page.goto(bibtex, { waitUntil: "networkidle2" });
  return await page.evaluate(() => {
    let book_titles = [];
    let data = document.querySelectorAll(".verbatim.select-on-click"),
      checking = false,
      article = null;
    for (let i = 0; i < data.length; i++) {
      if (data[i].innerText.includes("booktitle =")) {
        article = data[i].innerText.split("},");
        let book_title = article[3]
          .substring(16)
          .trim()
          .replace(/(\r\n|\n|\r)/gm, " ")
          .replace("                ", " ")
          .replace("                ", " ")
          .replace("                ", " ")
          .replace("                ", " ");
        book_titles.push(book_title);
      }
    }
    return book_titles;
  });
}

function checkAcronym(data, acronym, year) {
  let finishData = data;
  let check = false;
  for (let i = 0; i < finishData.length && !check; i++) {
    if (finishData[i].acronym.toLowerCase() === acronym.toLowerCase()) {
      if (!finishData[i].active) return false;
      check = true;
      let checkYear = false;
      for (let j = 0; j < finishData[i].tableCore.length && !checkYear; j++) {
        if (
          finishData[i].tableCore[j].core_year <= year ||
          finishData[i].tableCore.length == j + 1
        ) {
          return {
            core_year: finishData[i].tableCore[j].core_year,
            core_category: finishData[i].tableCore[j].core_category,
          };
        }
      }
    }
  }
  return null;
}
//Función que coge los parametros de JCR
async function jcr(articles, author, page, browser, mail, pass) {
  //Inicializamos los contadores que vamos a utilizar para saber cuantos articulos de cada tipo hay
  let contardor_q1 = 0;
  let contardor_q2 = 0;
  let contardor_q3 = 0;
  let contardor_q4 = 0;
  let errores = [];
  let contadorErrors = 0;
  //Habrimos la pagina de JCR y a la hora de loguearnos y selecionar UCM
  try {
    
  
  await page.goto("http://jcr-incites.fecyt.es/");
  await page.waitForSelector(".dd-selected");
  await page.click(".dd-selected");
  await page.evaluate(() => {
    let a = document.querySelectorAll(".dd-option");
    let check = false;
    for (let i = 0; i < a.length && !check; i++) {
      if (a[i].children[2].innerText.includes("ompluten")) {
        check = true;
        a[i].click();
        a[i].click();
      }
    }
  });
  await page.click("#form_submit_wayf");

  async function delay(time) {
    return new Promise(function (resolve) {
      setTimeout(resolve, time);
    });
  }
  //Meter username y pass en la pagina de la UCM de login
  await page.waitForSelector("#username");
  await page.waitForSelector("#password");
  await page.type("#username", mail);
  await page.type("#password", pass);
  await page.keyboard.press("Enter");

  //Buscamos publicacion por publicacion
  for (let i = 0; i < articles.length; i++) {

    //Cogemos el nombre de la revista desde el link de dblp
    let link = "https://dblp.org/" + articles[i].url;
    articles[i].jcr = {
      categoria: "",
      impact_factor: "",
      position: "",
      quartile: "",
    };
    delete articles[i].url;
    //Creamos un try catch por si ocurre algun error en la busqueda de datos.
    try {

    const pageAux = await browser.newPage();
    //Vamos a la pagina de la revista en DBLP
    await pageAux.goto(link);
    await pageAux.waitForSelector("#breadcrumbs ul li a span");
    //Hacemos dos evaluate de la pagina para coger en nombre y clickar en el;
    var nombre = await pageAux.evaluate(() => {
      let a = document.querySelectorAll("#breadcrumbs ul li a span");
      return a[a.length - 1].innerText;
    });
    await pageAux.evaluate(() => {
      let a = document.querySelectorAll("#breadcrumbs ul li a span");
      a[a.length - 1].click();
  
    });
    //Cogemos el Issn de la revista
    await pageAux.waitForSelector(".hide-body ");
    let a = await pageAux.evaluate(() => {
      return document.querySelector(".hide-body > ul > li").innerText;
    });
    //Tratamos el Issn
    let b = a
      .replace("issn:", "")
      .replace(";", "")
      .replace("(old)", "")
      .replace(" ", "")
      .replace("(print)", "")
      .replace("(online)", "");
    let c = b.split(" ");
    let contador = 0;
    let d = [];
    for (let i = 0; i < c.length; i++) {
      if (c[i] != "") {
        d[contador] = c[i];
        contador++;
      }
    }

    if(c[0] != "1571-0661"){
    //Cerramos la pagina de la DBLP de la revista
    await pageAux.close();
    //Meter el Issn de la revista en JCR
    await page.reload();
    let paginaJcr = await page.url();
    await page.waitForSelector("#search-inputEl");
    await page.type("#search-inputEl", c[0]);
    await page.waitForSelector(".x-boundlist");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await delay(3000);

    //Si hay mas de un nombre o Issn igual elegimos el primero para entrar.
    if(paginaJcr != await page.url()){
      await page.evaluate(() => {
       let x = document.querySelectorAll(".x-grid-cell-inner");
       x[0].click();
      });
      
    }
    //Esperamos a que se abra la pestaña y utilizamos esa a partir de ahora
    await delay(5000);
    await page.goto(paginaJcr);
    //Comprobamos si ha llegado a una pestaña con el Issn y si no probamos con el nombre.
    let pages = await browser.pages();
    if(pages.length == 2){
      await page.reload();
      await page.waitForSelector("#search-inputEl");
      await page.type("#search-inputEl", nombre);
      await page.waitForSelector(".x-boundlist");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await delay(5000);
     
    }
    //Volvemos a ver si ha encontrado resultado con el nombre si no ha sido asi no hacemos nada.
    pages = await browser.pages();
    if(pages.length == 3){
    let page2 = pages[2];
    await page.reload();
    await page2.waitForSelector(
      ".indicators-table > div .c .tb > table > tbody > tr"
    );

    //Cogemos todos los datos de todos los años para sacar el impact factor.
    const years = await page2.evaluate(() => {
      let hijos = document.querySelectorAll(
        ".indicators-table > div .c .tb > table > tbody > tr"
      );
      let allYears = [];
      for (let i = 0; i < hijos.length; i++) {
        allYears[i] = {};
        allYears[i].year = hijos[i].children[0].innerText;
        allYears[i].JIF = hijos[i].children[2].innerText;
      }
      return allYears;
    });
    
    //Cogemos el impact factor del año mas proximo sin pasarse
    let out = false;
    for (let j = 0; j < years.length && !out; j++) {
      if (years[j].year <= articles[i].year) {
        articles[i].jcr.impact_factor = years[j].JIF;
        out = true;
      }
    }

    //Para darle click en rank usamos ".tabset-head div" y hacemos el for que hecho ruben y click en el que incluya rank
    await page2.waitForSelector(".tabset-head div");
    await page2.evaluate(() => {
      let b = document.querySelectorAll(".tabset-head div");
      let check = false;
      for (let i = 0; i < b.length && !check; i++) {
        if (b[i].innerText.includes("Rank")) {
          check = true;
          b[i].click();
          b[i].click();
        }
      }
    });
    await page2.click(
      ".tabset.cur-tab-1.journal-data-tabset > .tabset-head > .tab-3"
    );
    //Cogemos las categorias
    await delay(4000);
    await page2.waitForSelector(".rank-table");
    let categorias = await page2.evaluate(() => {
      let b = document.querySelectorAll(".rank-table-categories > td > div");
      let categorias = [];
      let cont = 0;
      for (let i = 0; i < b.length / 2; i++) {
        categorias[cont] = {};
        categorias[cont] = b[i].attributes[0].value;
        cont++;
      }
      let hijos = document.querySelectorAll(
        ".rank-table > div > .component-body > div > div> .c >.tb > table > tbody > tr"
      );
      let rankTable = [];
      let datosCategory = [];
      for (let i = 0; i < hijos.length; i++) {
        rankTable[i] = [];
        rankTable[i][0] = hijos[i].children[0].innerText;
        let contador = 1;
        for (let j = 0; j < categorias.length; j++) {
          datosCategory[0] = {};
          datosCategory[0].categoria = categorias[j];
          datosCategory[0].rank = hijos[i].children[contador].innerText;
          contador++;
          datosCategory[0].quartile = hijos[i].children[contador].innerText;
          contador++;
          datosCategory[0].jif = hijos[i].children[contador].innerText;
          contador++;
          rankTable[i][j + 1] = datosCategory[0];
          contador = 1;
        }
      }

      return rankTable;
    });
    await page2.close();
    
    //Cogemos el indice del año correspondiente en la tabla rank
    let out2 = false;
    let indice = 0;
    for (let j = 0; j < categorias.length && !out2; j++) {
      if (categorias[j][0] <= articles[i].year) {
        indice = j;
        out2 = true;
      }
    }
    let maximoJIF = "";
    let indiceCategoria = "";
    for (let i = 0; i < categorias[indice].length; i++) {
      if (categorias[indice][i].jif > maximoJIF) {
        indiceCategoria = i;
      }
    }
    //Pasamos todos los datos de tank y los metemos en el Json y ademas añadimos 1 al contador del tipo que sea.
    articles[i].jcr.categoria = categorias[indice][indiceCategoria].categoria;
    articles[i].jcr.position = categorias[indice][indiceCategoria].rank;
    articles[i].jcr.quartile = categorias[indice][indiceCategoria].quartile;
    if (articles[i].jcr.quartile == "Q1") contardor_q1++;
    if (articles[i].jcr.quartile == "Q2") contardor_q2++;
    if (articles[i].jcr.quartile == "Q3") contardor_q3++;
    if (articles[i].jcr.quartile == "Q4") contardor_q4++;
  }
  await page.reload();
}
else{
  await pageAux.close();
}
 } catch (error) {

    pages = await browser.pages();
    if(pages.length == 3){
    await pages[2].close();
    }
     errores[contadorErrors] = "Ha ocurrido un error con JCR en el articulo "  + articles.title + " con nombre de revista: " + nombre + " cuyo autor es: "+ author.name + " link:" + link;
      contadorErrors++
      
      
 }
  }
  

  author.jcr.numero_publicaciones_q1 = contardor_q1;
  author.jcr.numero_publicaciones_q2 = contardor_q2;
  author.jcr.numero_publicaciones_q3 = contardor_q3;
  author.jcr.numero_publicaciones_q4 = contardor_q4;
} catch (error) {
  errores[contadorErrors]= "Ha ocurrido un error con la redirecion ezterna de JCR, intenta la consulta de nuevo";
}
  return errores;
}

async function scopus(
  articles,
  inproceedings,
  incollections,
  authorData,
  orcid,
  page,
  browser, 
  mail,
  pass
) {
  //Vamos a loguearnos lo primero
  await page.goto("https://www.scopus.com/home.uri");
  //If si no se ha netrado en jcr
  let bul = false
  
  await page.evaluate(() => {
    let botonSearch = document.querySelectorAll(".btn-text");
    botonSearch[1].click();
    //let botonSearch = document.querySelector("#pendo-button-03876376");
    //botonSearch.click();
    
  });
  await page.waitForSelector("#bdd-email");
  await page.type("#bdd-email", mail);
  await page.keyboard.press("Enter");

  await page.waitForSelector("#bdd-elsPrimaryBtn");
  await page.evaluate(() => {
    let botonSearch = document.querySelector("#bdd-elsPrimaryBtn");
    botonSearch.click();
  });
  //Meter username y pass en la pagina de la UCM de login
  await page.waitForSelector("#username");
  await page.waitForSelector("#password");
  await page.type("#username", mail);
  await page.type("#password", pass);
  await page.keyboard.press("Enter");

  //Buscamos por orcid en Scopus
  await page.waitForSelector("#authors-tab");
  await page.evaluate(() => {
    let botonSearch = document.querySelector("#authors-tab");
    botonSearch.click();
  });
  
  await page.waitForSelector(".button__icon");
  await page.waitForSelector("option[value='orcid']");
  await page.select(
    ".els-select.els-select--small.els-select--dirty > label > select",
    "orcid"
  );
  await page.waitForSelector("input[name='orcidId']");
  await page.type("input[name='orcidId']", orcid);
  await page.evaluate(() => {
    let botonSearch = document.querySelector(
      "#SubmitButton-module__submitButton___3L4a8"
    );
    botonSearch.click();
  });

  //Le damos click en el nombre para que entre en su scopus
  await page.waitForSelector(".docTitle");
  const pageScopus = await page.evaluate(() => {
    return document.querySelector(".docTitle").href;
  });

  await page.goto(pageScopus);

  async function delay(time) {
    return new Promise(function (resolve) {
      setTimeout(resolve, time);
    });
  }

  await page.waitForSelector("._2Y8rC6tZxrdhz4UUWoh3gQ");
  let metrics = await page.evaluate(() => {
    let metric = document.querySelectorAll("._2Y8rC6tZxrdhz4UUWoh3gQ");
    var result = [];
    for (let i = 0; i < metric.length; i++) {
      result[i] = metric[i].innerText;
    }
    return result;
  });

  authorData.indices.indice_h_total_scopus = metrics[2].replace(
    "\n\nh-index:\n\nViewh-graph",
    ""
  );
  authorData.citas.citas_total_scopus = metrics[1].replace("\n\n"," ");

  await page.waitForSelector("#export_results");
  //Le damos click a export
  await page.evaluate(() => {
    let botonExport = document.querySelector("#export_results");
    botonExport.click();
    let opcionAll = document.querySelector(
      "label[for='selectedCitationInformationItemsAll-Export']"
    );
    opcionAll.click();
    let title = document.querySelector(
      "label[for='selectedCitationInformationItems-Export2']"
    );
    title.click();
    let cita = document.querySelector(
      "label[for='selectedCitationInformationItems-Export6']"
    );
    cita.click();
    let text = document.querySelector("#TEXT");
    text.click();
    let expor = document.querySelectorAll(".btnText");
    expor[2].click();
  });

  await delay(8000);
  let pages = await browser.pages();
  let page2 = pages[2];
  const Texto = await page2.evaluate(() => {
    let a = document.querySelector("pre").innerText;

    return a;
  });
  await page.close();
  await page2.close();
  //Creamos un objeto con los title y las citas de scopus para comparar despues
  let a = Texto.split("\n");
  let scopusFinal = [];
  let contador = 0;
  for (let i = 3; i < a.length; i++) {
    scopusFinal[contador] = {};
    scopusFinal[contador].title = a[i];
    scopusFinal[contador].citas = a[i + 1];
    contador++;
    i += 3;
  }

  for (let j = 0; j < articles.length; j++) {
    articles[j].citas.numero_citas_scopus =  null;
    let checkFor = false;
    for (let i = 0; i < scopusFinal.length && !checkFor; i++) {
      if (
        articles[j].title.toLowerCase().replace("–", "-").replace(".", "") ===
        scopusFinal[i].title.toLowerCase().replace("–", "-")
      ) {
        articles[j].citas.numero_citas_scopus= scopusFinal[i].citas
            .replace(".", "")
            .replace("Cited", "")
            .replace("times.", "")
            .replace("time.","")
            .replace(" ", "")
        
        if(articles[j].citas.numero_citas_scopus === "") articles[j].citas.numero_citas_scopus = "0";
        
        checkFor = true;
      }
    }
  }
  for (let j = 0; j < inproceedings.length; j++) {
    inproceedings[j].citas.numero_citas_scopus=  null ;
    let checkFor = false;
    for (let i = 0; i < scopusFinal.length && !checkFor; i++) {
      if (
        inproceedings[j].title
          .toLowerCase()
          .replace("–", "-")
          .replace(".", "") ===
        scopusFinal[i].title.toLowerCase().replace("–", "-")
      ) {
       
        inproceedings[j].citas.numero_citas_scopus= scopusFinal[i].citas
            .replace(".", "")
            .replace("Cited", "")
            .replace("times.", "")
            .replace("time.","")
            .replace(" ", "")
        
        if (inproceedings[j].citas.numero_citas_scopus === "") inproceedings[j].citas.numero_citas_scopus=  "0";
        checkFor = true;
      }
    }
  }

  for (let j = 0; j < incollections.length; j++) {
    incollections[j].citas.numero_citas_scopus= null ;
    let checkFor = false;
    for (let i = 0; i < scopusFinal.length && !checkFor; i++) {
      if (
        incollections[j].title
          .toLowerCase()
          .replace("–", "-")
          .replace(".", "") ===
        scopusFinal[i].title.toLowerCase().replace("–", "-")
      ) {
        
        incollections[j].citas.numero_citas_scopus= scopusFinal[i].citas
            .replace(".", "")
            .replace("Cited", "")
            .replace("times.", "")
            .replace("time.","")
            .replace(" ", "")
        
        if (incollections[j].citas.numero_citas_scopus === "") incollections[j].citas.numero_citas_scopus= "0";
        checkFor = true;
      }
    }
  }
}

function initAuthor(name) {
  return {
    name: name,
    indices: {
      indice_h_total_google_scholar: 0,
      indice_h_5_years_google_scholar: 0,
      indice_i10_total_google_scholar: 0,
      indice_i10_5_years_google_scholar: 0,
      indice_h_total_scopus: 0,
    },
    citas: {
      citas_total_google_scholar: 0,
      citas_total_5_years_google_scholar: 0,
      citas_total_scopus: 0,
    },
    jcr: {
      numero_publicaciones_q1: 0,
      numero_publicaciones_q2: 0,
      numero_publicaciones_q3: 0,
      numero_publicaciones_q4: 0,
    },
    ggs: {
      numero_publicaciones_class_1: 0,
      numero_publicaciones_class_2: 0,
      numero_publicaciones_class_3: 0,
    },
    core: {
      numero_publicaciones_AA: 0,
      numero_publicaciones_A: 0,
      numero_publicaciones_B: 0,
      numero_publicaciones_C: 0,
    },
    errors: {
    },
  };
}
