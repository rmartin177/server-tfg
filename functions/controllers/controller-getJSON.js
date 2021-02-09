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
  let page = await res.locals.browser.newPage();
  let scrapping = new scrappingHelper();
  await scrapping.optimizationWeb(page);
  let haveHomonymsAndLinks = await checkCorrectAuthors(page, authors);
  console.log(haveHomonymsAndLinks);
  if (haveHomonymsAndLinks.haveHomonyms) {
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
  let { authors, filters };
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
    let checkName = checkAndBibtexAndName.checkName;
    let authorsChecking = {
      authors: AuthorsData,
      actualPosition: i,
    };
    let publications = await page.evaluate(
      (checkName, authorsChecking, filter) => {
        let valuesHTML = null,
          fullHTML = null;
        if (checkName) {
          //Si hay dos con el mismo nombre el XML cambia, debe usar estos selectores
          fullHTML = document.querySelectorAll(
            "#folder0  > .opened  > .folder:not(#folder2) .opened .folder:first-child .line > span:first-child"
          );
          valuesHTML = document.querySelectorAll(
            "#folder0  > .opened  > .folder:not(#folder2) .opened .folder:first-child .line span:nth-child(2):not(.html-attribute-value):not(.html-attribute)"
          );
        } else {
          //Estos son los estandard para el 99.9%
          valuesHTML = document.querySelectorAll(
            "#folder0  > .opened  > .folder .opened .folder:first-child .line span:nth-child(2):not(.html-attribute-value):not(.html-attribute)"
          );
          fullHTML = document.querySelectorAll(
            "#folder0  > .opened  > .folder .opened .folder:first-child .line > span:first-child"
          );
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
        };
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
    publicationsData = publications.incollections.concat(publicationsData);
    publicationsData = publications.inproceedings.concat(publicationsData);
    publicationsData = publications.articles.concat(publicationsData);
    AuthorsData.push(authorData);
  }
  /*await jrc(browser, page);*/
  /*await page.close()*/
  return {
    authors: AuthorsData,
    publications: publicationsData,
  };
}

async function jrc(browser, page) {
  await page.goto("https://dblp.org/db/conf/ictac/ictac2020.html#0001020");
  await page.waitForSelector("#breadcrumbs ul li a span");
  let a = await page.evaluate(() => {
    let a = document.querySelectorAll("#breadcrumbs ul li a span");
    return a[a.length - 1].innerText;
  });
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
  for (let i = 0; i < authors.length; i++) {
    await page.goto("https://dblp.org/", { waitUntil: "networkidle2" });
    await page.type('input[type="search"]', authors[i]);
    await page.keyboard.press("Enter");
    await page.waitForSelector("#completesearch-authors");
    //sameName sirve para ver si hay un selector homonimo (por si dos personas se llaman igual vamos, solo vi el caso de adrian riesco pero cambia toda la cabecera de su XML)
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
  };
}
