const http = require('http');
const url = require('url');

function isUrl(str) {
  try {
    new url.URL(str); 
    return true;
  } catch {
    return false;
  }
}

function validateInput(input) {
  if(null == input)
    return false;

  if(null == input.length)
    return false;

  if(input.length == 0) 
    return false;

  if(input.length > 500) 
    return false;

  return true;
}

async function callAiApi(apiUrl, input) {
  // replace all \n+ with \n
  input = input.replace(/\n+/g, '\n');

  if(!validateInput(input)) 
    return Promise.resolve("Invalid input");

  const payload = {
    "prompt": "User: " + input + "\n\nFurry Programmer (in English): ",
    "max_tokens": 500,
    "temperature": 1,
    "top_p": 0.9,
    "seed": 10
  };

  const urlCracked = new url.URL(apiUrl);
  const options = {
    method: 'POST',
    hostname: urlCracked.hostname,
    path: urlCracked.pathname,
    port: urlCracked.port,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(payload)),
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
        let data = '';

        if((res.statusCode >= 300)) {
          console.log("HTTP " + res.statusCode + " " + res.statusMessage);
          resolve("Service is not available");
        }

        res.on('error', (error) => {
            resolve("Service is not available");
            console.log(error);
        });

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
//            console.log(JSON.parse(data));
            resolve(JSON.parse(data).choices[0].text);
        });
    });

    req.write(JSON.stringify(payload));
    req.end();
});
}

module.exports = callAiApi;
