const url = $request.url;
const method = ($request.method || "GET").toUpperCase();
const body = $request.body;
const headers = Object.assign({}, $request.headers, { "X-Tiny-License-Sign": "" });

const log = (msg) => console.log("[TablePlus] " + msg);
log("request.url: " + url);
log("request.method: " + method);
log("request.body: " + body);

function parseBody() {
  try {
    return typeof body === "string" ? JSON.parse(body) : (body || {});
  } catch (e) {
    log("parse body failed: " + e);
    return {};
  }
}

function queryParam(key) {
  return new URLSearchParams((url.split("?")[1] || "")).get(key) || "";
}

function respond(status, payload) {
  $done({
    response: {
      status,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  });
}

function ok(data) {
  respond(200, Object.assign({ Code: 200, Message: "Ok" }, data));
}

function patchTablePlusBody(data) {
  try {
    const obj = JSON.parse(data);
    if (obj.Data) {
      obj.Data.DayBeforeExpiration = 9999;
      obj.Data.LicenseKey = "";
    }
    return JSON.stringify(obj);
  } catch (e) {
    log("parse response failed: " + e);
    return data;
  }
}

function forward() {
  const client = $httpClient[method.toLowerCase()];
  if (!client) {
    log("Unsupported method: " + method);
    return $done({});
  }

  const req = { url, headers };
  if (method !== "GET" && method !== "HEAD") req.body = body;

  client(req, (error, response, data) => {
    if (error) {
      log("request failed: " + error);
      return $done({});
    }

    log("response.status: " + response.status);
    log("response.body: " + data);

    const isTablePlus = url.includes("v1/apps/osx/tableplus");
    $done({
      response: {
        status: isTablePlus ? 200 : response.status,
        headers: response.headers,
        body: isTablePlus ? patchTablePlusBody(data) : data
      }
    });
  });
}

if (url.includes("v1/licenses/register")) {
  const { licenseKey = "", deviceID = "" } = parseBody();
  log("licenseKey: " + licenseKey);
  log("deviceID: " + deviceID);
  ok({
    Data: {
      sign: "12345678901234567890123456789012345678901234567890",
      email: "injectxteam@gmail.com",
      deviceID,
      licenseKey,
      purchasedAt: "2025-12-31",
      nextChargeAt: 9999,
      updatesAvailableUntil: "2099-12-31"
    }
  });
} else if (url.includes("v1/licenses/devices")) {
  const deviceID = queryParam("deviceID");
  log("deviceID: " + deviceID);
  ok({
    Data: {
      DeviceID: deviceID,
      UpdatesAvailableUntilString: "2025-12-31",
      updatesAvailableUntil: "2099-12-31"
    }
  });
} else {
  forward();
}
