const ExcelToJson = require("convert-excel-to-json")
class excel {

    parseCORE2018 = (data, acronym) => {
        data.GII.splice(0, 1);
        //llamar funcion divide
        let finishData = data.GII;
        const result= this.lineal(finishData,acronym);
        //const result = this.divide(0, 2832, finishData, acronym)
        if (result.class == "Work in Progress") {
            result.year = null;
            result.class = null;
        }
        return {
            year: result.year,
            class: result.class
        }
    };

    readExcelCORE2018 = (acronym) => {
        let filename = __dirname.slice(0, -5) + 'data/core2018.xlsx';
        let results = ExcelToJson({
            sourceFile: filename
        });
        let correct = this.parseCORE2018(results, acronym);
        return correct;
    }

    divide = (ini, fin, data, acronym) => {
        if ((fin - ini) == 0) {
            if (data[ini].A == acronym) {
                return {
                    year: 2018,
                    class: data[ini].B
                }
            }
            else {
                return {
                    year: null,
                    class: null
                }
            }
        }
        else if ((fin - ini) == 1) {
            if (data[ini].A == acronym) {
                return {
                    year: 2018,
                    class: data[ini].B
                }
            }
            else if (data[fin].A == acronym) {
                return {
                    year: 2018,
                    class: data[fin].B
                }
            }
            else {
                console.log("etro aqui");
                return {
                    year: null,
                    class: null
                };
            }
        }
        else {
            let mitad = Math.floor((ini + fin) / 2);
            if (data[mitad].A == acronym) {
                return {
                    year: 2018,
                    class: data[mitad].B
                }
            }
            else {
                if (data[mitad].A > acronym) {
                    return this.divide(ini, mitad, data, acronym);
                }
                else {
                    return this.divide(mitad, fin, data, acronym);
                }
            }
        }
    };
    lineal = (data, acronym) => {
        for (let i = 0; i < data.length; i++) {
            if (data[i].A == acronym) {
                return {
                    year: 2018,
                    class: data[i].B
                }
            }
        }
        return {
            year: null,
            class: null
        }
    }

}
module.exports = excel;