const axios = require('axios');
const csv = require('csv-parser');
const fs = require('fs');

async function test() {
  const response = await axios({
    url: 'https://images.dhan.co/api-data/api-scrip-master.csv',
    method: 'GET',
    responseType: 'stream'
  });

  let count = 0;
  let futstkCount = 0;
  let sampleFUT = null;
  
  response.data
    .pipe(csv())
    .on('data', (data) => {
      count++;
      if (data.SEM_EXM_EXCH_ID === 'NSE_FNO' && data.SEM_INSTRUMENT_NAME === 'FUTSTK') {
        futstkCount++;
        if (!sampleFUT) sampleFUT = data;
      }
    })
    .on('end', () => {
      console.log('Total rows:', count);
      console.log('FUTSTK count:', futstkCount, sampleFUT);
    });
}
test();
