const ExcelToJson = require("convert-excel-to-json")
const fs = require("fs")
class excel {

    parseGGS = (data, acronym, year) => {
        data.GGS.splice(0, 1);
        let finishData = data.GGS;
       let result = this.divide(0, data.GGS.length, finishData, acronym, year)
        if (result.class == "Work in Progress" || result.class == "W") {
            result.year = null;
            result.class = null;
        }
        return {
            year: result.year,
            class: result.class
        }
    };

    readExcelGGS = (acronym, year) => {
        let filename = "";
        if (year < "2017") filename = __dirname.slice(0, -5) + 'data/GGS2015.xlsx';
        else if (year < "2018") filename = __dirname.slice(0, -5) + 'data/GGS2017.xlsx';
        else filename = __dirname.slice(0, -5) + 'data/GGS2018.xlsx';
        let results = ExcelToJson({
            sourceFile: filename
        });
        let correct = this.parseGGS(results, acronym);
        return correct;
    };

    filterGGSperYear = (acronym, year) => {
        let rawData = "", filename = "";
        if (year < "2017"){ filename = __dirname.slice(0, -5) + 'data/GGS2015.json'; year = 2015;}
        else if (year < "2018") {filename = __dirname.slice(0, -5) + 'data/GGS2017.json'; year = 2017;}
        else {filename = __dirname.slice(0, -5) + 'data/GGS2018.json'; year = 2018;}
        rawData = fs.readFileSync(filename)
        let results = JSON.parse(rawData)
        let correct = this.parseGGS(results, acronym, year);
        return correct;
    };
    
    divide = (ini, fin, data, acronym, year) => {
        if ((fin - ini) == 0) {
            if (data[ini].A == acronym) return {
                    year: year,
                    class: data[ini].B
                }
            else return {
                    year: null,
                    class: null
                }
        }
        else if ((fin - ini) == 1) {
            if (data[ini].A == acronym) return {
                    year: year,
                    class: data[ini].B
                }
            else if (data[fin].A == acronym) return {
                    year: year,
                    class: data[fin].B
                }
            else return {
                    year: null,
                    class: null
                }
        }
        else {
            let half = Math.floor((ini + fin) / 2);
            if (data[half].A == acronym) return {
                    year: year,
                    class: data[half].B
                }
            else {
                if (data[half].A > acronym) return this.divide(ini, half, data, acronym, year);
                else return this.divide(half, fin, data, acronym, year);
            }
        }
    };
    divideGoogle = (ini, fin, articles, title,) => {
        if ((fin - ini) == 0) {
            if (articles[ini].title == title) 
            return ini
            else return -1;
        }
        else if ((fin - ini) == 1) {
            if (articles[ini].title == title) 
                return ini
            else if (articles[fin].title == title) 
                return fin
                   
            else 
            return -1;
        }
        else {
            let half = Math.floor((ini + fin) / 2);
            if (articles[half].title == title) 
            return half
            else {
                if (articles[half].title> title) return this.divide(ini, half, data, acronym);
                else return this.divide(half, fin, data, acronym);
            }
        }
    };
}

module.exports = excel;