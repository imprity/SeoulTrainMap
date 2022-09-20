
let loadCsv = function (pathTofile) {
    let promise = new Promise((response, reject) => {
        fetch(pathTofile)
            .then(res => {
                if (res.ok) {
                    res.text()
                        .then(x => {

                            let data = [];

                            let dataW = Number.MAX_VALUE;


                            let lbSeperated = x.split('\n');

                            let dataH = lbSeperated.length;

                            lbSeperated.forEach(line => {
                                line = line.replace(/\r?\n|\r/u,'');
                                let cSeperated = line.split(',');
                                dataW = Math.min(dataW, cSeperated.length);
                                cSeperated.forEach(value => {
                                    data.push(value);
                                })
                            });

                            // we will switch column and row
                            let processedData = [];

                            for (let x = 0; x < dataW; x++) {
                                let toPush = [];
                                for (let y = 0; y < dataH; y++) {
                                    toPush.push(data[x + y * dataW])
                                }
                                processedData.push(toPush);
                            }

                            response(processedData);
                        })
                        .catch(err => { reject(err); });
                }
                else {
                    throw new Error(res.statusText);
                }
            })
            .catch(err => {
                reject(err);
            });
    });
    return promise;
}

function toCsvString(csvData){
    let toReturn = '';
    let minLength = Number.MAX_SAFE_INTEGER;
    let firstLength = csvData[0].length;
    let logged = false;
    csvData.forEach(arr=>{
        if(arr.length != firstLength && !logged){
            console.warn('csv columns have different length. some datas will be cut');
            logged = true;
        }
        minLength = Math.min(minLength, arr.length);
    })
    
    for(let i=0; i<minLength; i++){
        for(let j=0; j<csvData.length; j++){
            toReturn += csvData[j][i].toString().replace(/\r?\n|\r/u, '');
            if(j != csvData.length-1)
                toReturn += ',';
        }
        if(i != minLength-1)
            toReturn += '\n';
    }
    return toReturn;
}

export {loadCsv, toCsvString};