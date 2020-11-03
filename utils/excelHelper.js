const ExcelToJson = require("convert-excel-to-json")
class excel {
    
        parseCORE2018 =  (data, acronym) => {
        data.GII.splice(0, 1);
        let finishData = data.GII;
        const result =  this.divide(0,2832,finishData,acronym)
        if(result.class == "Work in Progress"){
            result.year = null;
            result.class= null;
        }
        return{
            year: result.year,
            class: result.class
        }
    };

    readExcelCORE2018 = (acronym) =>{
        let filename = __dirname.slice(0, -5) + 'data/core2018.xlsx';
        let results = ExcelToJson({
            sourceFile: filename
        });
        let correct = this.parseCORE2018(results, acronym);
        return correct;
    };
     divide = (ini,fin,data,acronym) => {
    
        if((fin - ini) == 0){
           if(data[ini].A == acronym){
               return {
                   year: 2018,
                   class: data[ini].B
               }
           }
           else{
               return {
                   year: null,
                   class: null
               }
           }
           }
    
        else if((fin -ini) == 1){
           if(data[ini].A == acronym){
               return {
                   year: 2018,
                   class: data[ini].B
               }
           }
           else if(data[fin].A == acronym){
        
               return {
                   year: 2018,
                   class: data[fin].B
               }
           }
           else{
               return {
                   year: null,
                   class: null
               } 
           }
       }
       else{
           let half = Math.floor((ini + fin ) / 2);
            
           if(data[half].A == acronym){
               return {
                   year: 2018,
                   class: data[half].B
               }
           }
           else{
               if(data[half].A > acronym){
                   return this.divide(ini,half,data,acronym);
               }
                
               else{
                   return this.divide(half,fin,data,acronym);
               }
    
               
           }
       }
    };
    
    
}
 
module.exports = excel;