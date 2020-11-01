const ExcelToJson = require("convert-excel-to-json")
class excel {

    parseCORE2018 = (data, acronym) => {
        data.GII.splice(0, 1);
    
        let founded = false;

        //llamar funcion divide
        if(!founded) return {
            year: null,
            class: null
        };
        else return {
            year: 2018,
            class: 2 //la que toque, el 2 es un ejemplo
        }
    };

    readExcelCORE2018 = (acronym) =>{
        let filename = __dirname.slice(0, -5) + 'data/core2018.xlsx';
        let results = ExcelToJson({
            sourceFile: filename
        });
        let correct = this.parseCORE2018(results, acronym);
        return correct;
    }
}
module.exports = excel;