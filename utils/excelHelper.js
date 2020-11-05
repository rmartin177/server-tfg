const ExcelToJson = require("convert-excel-to-json")
const fs = require("fs")
class excel {

    parseGSS = (data, acronym) => {
        data.GGS.splice(0, 1);
        let finishData = data.GGS;
        const result = this.divide(0, data.GGS.length, finishData, acronym)
        if (result.class == "Work in Progress" || result.class == "W") {
            result.year = null;
            result.class = null;
        }
        return {
            year: result.year,
            class: result.class
        }
    };

    readExcelGSS = (acronym, year) => {
        let filename = "";
        if (year < "2017") filename = __dirname.slice(0, -5) + 'data/GGS2015.xlsx';
        else if (year < "2018") filename = __dirname.slice(0, -5) + 'data/GGS2017.xlsx';
        else filename = __dirname.slice(0, -5) + 'data/GGS2018.xlsx';
        let results = ExcelToJson({
            sourceFile: filename
        });
        let correct = this.parseGSS(results, acronym);
        return correct;
    };

    filterGSSperYear = (acronym, year) => {
        let rawData = "", filename = "";
        if (year < "2017") filename = __dirname.slice(0, -5) + 'data/GGS2015.json';
        else if (year < "2018") filename = __dirname.slice(0, -5) + 'data/GGS2017.json';
        else filename = __dirname.slice(0, -5) + 'data/GGS2018.json';
        rawData = fs.readFileSync(filename)
        let results = JSON.parse(rawData)
        let correct = this.parseGSS(results, acronym);
        return correct;
    };
    
    divide = (ini, fin, data, acronym) => {
        if ((fin - ini) == 0) {
            if (data[ini].A == acronym) return {
                    year: 2018,
                    class: data[ini].B
                }
            else return {
                    year: null,
                    class: null
                }
        }
        else if ((fin - ini) == 1) {
            if (data[ini].A == acronym) return {
                    year: 2018,
                    class: data[ini].B
                }
            else if (data[fin].A == acronym)  return {
                    year: 2018,
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
                    year: 2018,
                    class: data[half].B
                }
            else {
                if (data[half].A > acronym) return this.divide(ini, half, data, acronym);
                else return this.divide(half, fin, data, acronym);
            }
        }
    };
}

module.exports = excel;