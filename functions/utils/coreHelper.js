const fs = require("fs")
class jsonCore {

    checkAcronym = (data, acronym, year) => {
        let finishData = data.acronyms;
        let check = false;
        for(let i = 0; i < finishData.length && !check; i++){
            if(finishData[i].acronym.toLowerCase() === acronym.toLowerCase()){
                if(!finishData[i].active) return false;
                check = true;
                let checkYear = false;
                for(let j = 0; j < finishData[i].tableCore.length && !checkYear; j++){
                    if(finishData[i].tableCore[j].core_year <= year || finishData[i].tableCore.length == (j+1)){
                        return {
                            core_year: finishData[i].tableCore[j].core_year,
                            core_category: finishData[i].tableCore[j].core_category
                        }
                    }
                }
            }
        } return null;
    }

    getData = () =>{
        let filename = __dirname.slice(0, -5) + 'data/core.json'
        let rawData = fs.readFileSync(filename, (err)=>{console.log("explota")})
        let jsonData = JSON.parse(rawData)
        return jsonData;
    }

    updateJson = (newData) =>{
        let dataReverseParser = JSON.stringify(newData)
        fs.writeFileSync(__dirname.slice(0, -5) + "data/core.json", dataReverseParser, (err) => { console.log(err); });
        return true;
    }
}

module.exports = jsonCore;