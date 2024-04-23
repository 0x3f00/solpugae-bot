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


async function callAiApi(apiUrl, template, input) {
  // replace all \n+ with \n
  input = input.replace(/\n+/g, '\n');

  template = template.replace(/%TEXT%/g, input);
  const payload = {
    "prompt": template,
    "max_tokens": 200,
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
          reject("HTTP " + res.statusCode + " " + res.statusMessage);
        }

        res.on('error', (error) => {
            reject();
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

    req.on('error', function(error) {
      reject("No listener");
    });

    req.write(JSON.stringify(payload));
    req.end();
});
}

module.exports = callAiApi;
