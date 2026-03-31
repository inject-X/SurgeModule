const url = $request.url;
const method = ($request.method || "GET").toUpperCase();
const body = $request.body;
const requestHeaders = Object.assign({}, $request.headers || {});

console.log("[Alcove] request.url: " + url);
console.log("[Alcove] request.method: " + method);
console.log("[Alcove] request.body: " + body);

const license$ = {
    key: "88888888-8888-8888-8888-888888888888",
    active: true,
    beta: false,
    name: "InjectX-Team",
    email: "injectxteam@gmail.com",
    limit: 999,
    usage: 1,
    instance: {
        id: "35787161-5114-5772-bbdb-cb2821d339d9",
        name: "InjectX",
        model: "team@injectx.com"
    }
};

const trial$ = {
    uuid: "35787161-5114-5772-bbdb-cb2821d339d9",
    started_at: "2026-02-24T03:36:32+01:00",
    ends_at: "2099-12-31T00:00:00+01:00",
    active: true
};

const endpoints = [
  {
    pattern: /^https:\/\/api\.tryalcove\.com\/trial(?:\/([A-F0-9-]+))?$/i,
    response: trial$
  },
  {
    pattern: /^https:\/\/api\.tryalcove\.com\/license\/validate$/i,
    response: license$
  },
  {
    pattern: /^https:\/\/api\.tryalcove\.com\/license\/activate$/i,
    response: license$
  },
  {
    pattern: /^https:\/\/api\.tryalcove\.com\/license\/deactivate$/i,
    response: license$
  }
];

function buildHeaders(signature) {
  const headers = {
    "Content-Type": "application/json"
  };
  if (signature) headers["X-Device-Signature"] = signature;
  return headers;
}

function sha256(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  let mathPow = Math.pow;
  let maxWord = mathPow(2, 32);
  let lengthProperty = 'length';
  let i, j;
  let result = '';

  let words = [];
  let asciiBitLength = ascii[lengthProperty] * 8;

  let hash = sha256.h = sha256.h || [];
  let k = sha256.k = sha256.k || [];
  let primeCounter = k[lengthProperty];

  let isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1/3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';

  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }

  words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
  words[words[lengthProperty]] = (asciiBitLength);

  for (j = 0; j < words[lengthProperty];) {
    let w = words.slice(j, j += 16);
    let oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      let w15 = w[i - 15], w2 = w[i - 2];

      let a = hash[0], e = hash[4];
      let temp1 =
        hash[7]
        + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
        + ((e & hash[5]) ^ ((~e) & hash[6]))
        + k[i]
        + (w[i] = (i < 16) ? w[i] : (
          w[i - 16]
          + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
          + w[i - 7]
          + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
        ) | 0
        );

      let temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
        + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      let b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? 0 : '') + b.toString(16);
    }
  }
  return result;
}



function doneJson(status, headers, obj) {
  $done({
    response: {
      status: status,
      headers: headers,
      body: JSON.stringify(obj)
    }
  });
}

function handleMock() {
  for (const endpoint of endpoints) {
    const match = endpoint.pattern.exec(url);
    if (match) {
      console.log("[Alcove] Matched mock: " + endpoint.pattern);
      let hardware_uuid = null;
      // trial 请求，取 URL 最后一个 id
      if (/\/trial/.test(url)) {
        hardware_uuid = match[1] ? match[1].toLowerCase() : null;
        if (hardware_uuid) {
          console.log("[Alcove] trial id: " + hardware_uuid);
        }
      } else if (/\/license\/(deactivate|activate|validate)/.test(url)) {
        let parsedBody = {};
        try {
          parsedBody = typeof body === 'string' ? JSON.parse(body) : (body || {});
        } catch (e) {
          parsedBody = {};
        }
        hardware_uuid = parsedBody.hardware_uuid ? String(parsedBody.hardware_uuid).toLowerCase() : null;
        if (hardware_uuid) {
          console.log("[Alcove] hardware_uuid: " + hardware_uuid);
        }
      }
      // signature 逻辑：response 转 json 拼接 hardware_uuid，sha256
      console.log('[Alcove] endpoint.response:' + JSON.stringify(endpoint.response));
      const responseStr = JSON.stringify(endpoint.response) + (hardware_uuid || '');
      console.log('[Alcove] signature input string:' + responseStr);
      let signatureResult = sha256(responseStr);
      if (signatureResult && typeof signatureResult.then === 'function') {
        // Promise (浏览器/Surge/QuantumultX/JSBox)
        signatureResult.then(signature => {
          console.log('[Alcove] signature (async):' + signature);
          doneJson(200, buildHeaders(signature), endpoint.response);
        });
      } else {
        // Node.js 或同步
        console.log('[Alcove] signature (sync):' + signatureResult);
        doneJson(200, buildHeaders(signatureResult), endpoint.response);
      }
      return true;
    }
  }
  return false;
}

function handleForward() {
  const client = $httpClient[method.toLowerCase()];

  if (!client) {
    console.log("[Alcove] Unsupported method: " + method);
    $done({});
    return;
  }

  const req = {
    url: url,
    headers: requestHeaders
  };

  if (method !== "GET" && method !== "HEAD") {
    req.body = body;
  }

  client(req, function (error, response, data) {
    if (error) {
      console.log("[Alcove] Forward failed: " + error);
      $done({});
      return;
    }

    console.log("[Alcove] Forward status: " + response.status);
    console.log("[Alcove] Forward headers: " + JSON.stringify(response.headers));
    console.log("[Alcove] Forward body: " + data);

    $done({
      response: {
        status: response.status,
        headers: response.headers,
        body: data
      }
    });
  });
}

(function () {
  try {
    if (!handleMock()) {
      handleForward();
    }
  } catch (err) {
    console.log("[Alcove] Script error: " + err);
    doneJson(200, { "Content-Type": "application/json" }, {
      error: "script_error",
      message: String(err)
    });
  }
})();
