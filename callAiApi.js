const http = require('http');
const https = require('https');
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
    "max_tokens": 450,
    "temperature": 1,
    "top_p": 0.9,
    "seed": Math.floor(Math.random() * 1000000),
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

async function callAiApiGemini(token, input) {
  const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
  // replace all \n+ with \n
  input = input.replace(/\n+/g, '\n');

  // {"contents":[{"role": "user","parts":[{"text": "Give me five subcategories of jazz?"}]}]}
  const payload = {
    "model": "gemini-2.0-flash",
    "contents": [
      {
        "role": "user",
        "parts": [
          {
            "text": input
          }
        ]
      }
    ],
    "generationConfig": {
      "temperature": 1.0,
      "maxOutputTokens": 450
    }
  }

  console.log(JSON.stringify(payload));  

  const urlCracked = new url.URL(apiUrl);
  const options = {
    method: 'POST',
    hostname: urlCracked.hostname,
    path: urlCracked.pathname,
    port: urlCracked.port || 443,
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': token,
      'Content-Length': Buffer.byteLength(JSON.stringify(payload)),
    }
  };

  return new Promise((resolve, reject) => {
//    resolve(JSON.stringify(payload));
    const req = https.request(options, (res) => {
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
          const reply = JSON.parse(data);
          console.log(JSON.stringify(reply));
          if(reply.error)
          {
            if(reply.error.message)
              reject(reply.error.message);
            else if (reply.error.status)
              reject(reply.error.status);
            else
              reject("No error code");
          }

          if(reply.candidates 
            && reply.candidates[0] 
            && reply.candidates[0].content 
            && reply.candidates[0].content.parts 
            && reply.candidates[0].content.parts[0] 
            && reply.candidates[0].content.parts[0].text)
            {
              resolve(reply.candidates[0].content.parts[0].text);
            }
            else
            {
              reject("No content");
            }
        });
    });

    req.on('error', function(error) {
      reject("No listener");
    });

    req.write(JSON.stringify(payload));
    req.end();
});
}

//module.exports = callAiApi;
module.exports = callAiApiGemini;
