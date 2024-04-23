const http = require('http');
const url = require('url');

function isUrl(str) {
  try {
    new url.URL(str); // eslint-disable-line no-new
    return true;
  } catch {
    return false;
  }
}


async function urlExists(inputUrl) {
  if (!isUrl(inputUrl)) {
    return Promise.resolve(false);
  }

  const options = {
    method: 'HEAD',
    hostname: new url.URL(inputUrl).hostname,
    path: new url.URL(inputUrl).pathname,
    port: 80,
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      resolve(res.statusCode < 400 || res.statusCode >= 500);
    });

    req.on('error', function(error) {
      reject(error);
    });

    req.end();
  });
}

module.exports = urlExists;
