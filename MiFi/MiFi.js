/*
 * Surge 随身 Wi-Fi (Marvell / ASR Duster 后台) 双面板脚本
 * 参数示例: mode=status|detail&ssid=Wi-Fi&host=192.168.1.1&pwd=1&user=admin&admin_pwd=admin
 */

const COLORS = {
  online: "#0D9488",
  detail: "#2563EB",
  warning: "#D97706",
  error: "#DC2626",
  idle: "#8E8E93",
};

const CARRIER_BY_ICCID = {
  "898600": "中国移动",
  "898602": "中国移动",
  "898604": "中国移动",
  "898607": "中国移动",
  "898608": "中国移动",
  "898613": "中国移动",
  "898601": "中国联通",
  "898606": "中国联通",
  "898609": "中国联通",
  "898603": "中国电信",
  "898605": "中国电信",
  "898611": "中国电信",
  "898615": "中国广电",
};

const SHORT_CARRIER_BY_ICCID = {
  "898600": "移动",
  "898602": "移动",
  "898604": "移动",
  "898607": "移动",
  "898608": "移动",
  "898613": "移动",
  "898601": "联通",
  "898606": "联通",
  "898609": "联通",
  "898603": "电信",
  "898605": "电信",
  "898611": "电信",
  "898615": "广电",
};

const CARRIER_BY_NAME = {
  "CHN TELECOM": "中国电信",
  "CHINA TELECOM": "中国电信",
  "CHN-CT": "中国电信",
  "46003": "中国电信",
  "46011": "中国电信",
  "CHN MOBILE": "中国移动",
  "CHINA MOBILE": "中国移动",
  CMCC: "中国移动",
  "46000": "中国移动",
  "46002": "中国移动",
  "46007": "中国移动",
  "CHN UNICOM": "中国联通",
  "CHINA UNICOM": "中国联通",
  "CHN-UNICOM": "中国联通",
  CUCC: "中国联通",
  "46001": "中国联通",
  "46006": "中国联通",
  "46009": "中国联通",
  "CHINA BROADNET": "中国广电",
  CBN: "中国广电",
  "46015": "中国广电",
};

const RADIO_MODE = {
  "17": "4G",
  "15": "3G",
  "5": "3G",
  "3": "2G",
};

const LTE_DL_BW = {
  "0": "1.4MHz",
  "1": "3MHz",
  "2": "5MHz",
  "3": "10MHz",
  "4": "15MHz",
  "5": "20MHz",
  "10": "10MHz",
  "15": "15MHz",
  "20": "20MHz",
};

const PIN_ERROR = {
  "1": "SIM 卡需输入 PIN",
  "2": "SIM 卡需输入 PUK",
  "3": "SIM 卡已锁定",
  "4": "SIM 卡状态异常",
};

const WIFI_SECURITY = {
  Mixed: "WPA/WPA2",
  "WPA2-WPA3": "WPA2/WPA3",
  "WPA2-PSK": "WPA2",
  "WPA-PSK": "WPA",
  "WPA3-SAE": "WPA3",
  WEP: "WEP",
  "WAPI-PSK": "WAPI",
  Open: "开放网络",
  None: "开放网络",
};

function numeric(value) {
  if (value == null || String(value).trim() === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function cleanText(value, fallback = "—") {
  if (value == null) return fallback;
  const s = String(value).replace(/[\r\n\t]+/g, " ").trim();
  return s === "" || s.toLowerCase() === "n/a" || s === "NA" ? fallback : s;
}

function formatBytes(value) {
  let amount = numeric(value);
  if (amount == null || amount < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let idx = 0;
  while (amount >= 1024 && idx < units.length - 1) {
    amount /= 1024;
    idx++;
  }
  const decimals = idx === 0 ? 0 : idx >= 3 ? 2 : 1;
  return `${amount.toFixed(decimals)} ${units[idx]}`;
}

function formatCompactBytes(value) {
  const full = formatBytes(value);
  return full === "—" ? full : full.replace(" ", "");
}

function formatSpeed(value) {
  const base = formatBytes(value);
  return base === "—" ? "0 B/s" : `${base}/s`;
}

function formatUptime(value) {
  const seconds = numeric(value);
  if (seconds == null || seconds < 0) return "—";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return `${Math.floor(seconds)} 秒`;
  if (minutes < 60) return `${minutes} 分`;
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h} 时 ${m} 分` : `${h} 时`;
  }
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  return `${d} 天 ${h} 时`;
}

function decodeUniHex(value) {
  if (typeof value !== "string") return cleanText(value);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length % 4 !== 0 || !/^[0-9a-f]+$/i.test(trimmed)) {
    return cleanText(trimmed);
  }
  const codes = [];
  for (let i = 0; i < trimmed.length; i += 4) {
    codes.push(parseInt(trimmed.slice(i, i + 4), 16));
  }
  // Duster UniEncode 编码中 ASCII 必为 00xx，汉字主要落在常见 BMP 区间；避免将纯明文如 "1234" 误解码
  const plausible = codes.every(
    (c) => (c >= 0x20 && c <= 0x7e) || (c >= 0x2000 && c <= 0x9fff) || (c >= 0xff00 && c <= 0xffef)
  );
  if (!plausible) return cleanText(trimmed);
  return cleanText(String.fromCharCode(...codes));
}

function resolveCarrier(iccid, networkName) {
  const prefix = typeof iccid === "string" ? iccid.trim().slice(0, 6) : "";
  if (CARRIER_BY_ICCID[prefix]) return CARRIER_BY_ICCID[prefix];
  const rawName = typeof networkName === "string" ? networkName.trim() : "";
  if (!rawName) return "蜂窝网络";
  return CARRIER_BY_NAME[rawName.toUpperCase()] || cleanText(rawName, "蜂窝网络");
}

function simSlotName(simId, simName, short = false) {
  const id = String(simId ?? "");
  if (id === "2" || /^usim$/i.test(simName)) return short ? "外置" : "外置卡";
  if (id === "0" || /^esim1$/i.test(simName)) return short ? "内置1" : "内置卡1";
  if (id === "1" || /^esim2$/i.test(simName)) return short ? "内置2" : "内置卡2";
  if (id === "3" || /^esim3$/i.test(simName)) return short ? "内置3" : "内置卡3";
  return cleanText(simName, short ? "SIM" : "SIM卡");
}

function parseSimSummary(mss) {
  if (!mss || !Array.isArray(mss.sim_list) || mss.sim_list.length === 0) return null;
  const activeId = String(mss.current_sim_id ?? mss.sole_sim_id ?? "");
  const smartSwitch = String(mss.switch_mode) === "0";
  const activeSim = mss.sim_list.find((s) => String(s.sim_id) === activeId);
  const activeLabel = activeSim
    ? `${simSlotName(activeSim.sim_id, activeSim.sim_name, false)}${smartSwitch ? "(智选)" : ""}`
    : smartSwitch
      ? "智能选网"
      : "";

  // 排序：外置卡优先或当前激活卡优先，便于一眼查看全部卡槽
  const ordered = [...mss.sim_list].sort((a, b) => {
    const aActive = String(a.sim_id) === activeId ? 0 : 1;
    const bActive = String(b.sim_id) === activeId ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return Number(a.sim_id) - Number(b.sim_id);
  });

  const parts = [];
  for (const sim of ordered) {
    const isActive = String(sim.sim_id) === activeId;
    const slot = simSlotName(sim.sim_id, sim.sim_name, true);
    if (String(sim.sim_present) !== "1") {
      if (String(sim.sim_id) === "2") parts.push(`${slot}空`);
      continue;
    }
    const prefix = String(sim.sim_iccid || "").slice(0, 6);
    const op = SHORT_CARRIER_BY_ICCID[prefix] || "";
    const banned = String(sim.sim_banned) === "1" ? "(禁)" : "";
    parts.push(`${slot}${op}${banned}${isActive ? "✓" : ""}`);
  }

  const slotsLine = parts.length > 0 ? `${smartSwitch ? "智选 · " : ""}${parts.join(" · ")}` : null;
  return { activeLabel, slotsLine, count: mss.sim_list.length };
}

function parseLteMetrics(eng) {
  if (!eng || String(eng.sys_mode) !== "17" || !eng.lte || typeof eng.lte !== "object") return null;
  const lte = eng.lte;
  if (!lte.band && lte.rsrp == null && lte.sinr == null) return null;
  const band = cleanText(lte.band, "");
  const bw = LTE_DL_BW[String(lte.dlBandwidth ?? "")] || "";
  const rawRsrp = numeric(lte.rsrp);
  const rsrp = rawRsrp == null ? null : rawRsrp < 0 ? rawRsrp : rawRsrp - 141;
  const rawRsrq = numeric(lte.rsrq);
  const rsrq = rawRsrq == null ? null : rawRsrq < 0 ? rawRsrq : -20 + rawRsrq / 2;
  const sinr = numeric(lte.sinr);
  const pci = cleanText(lte.phyCellId, "");
  const earfcn = cleanText(lte.dlEuArfcn, "");
  return { band, bw, rsrp, rsrq, sinr, pci, earfcn };
}

function hasValidGlobalIPv6(addr) {
  if (typeof addr !== "string") return false;
  const s = addr.trim();
  if (!s || !s.includes(":")) return false;
  if (/^[0:]+$/.test(s)) return false;
  if (/^fe80:/i.test(s)) return false;
  return true;
}

// 纯 JS MD5 (RFC 1321)，用于设备要求 Digest 鉴权时自动无感登录
function md5(input) {
  const utf8 = unescape(encodeURIComponent(String(input)));
  const words = [];
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= utf8.charCodeAt(i) << ((i % 4) * 8);
  }
  const bitLen = utf8.length * 8;
  words[bitLen >> 5] |= 0x80 << (bitLen % 32);
  words[(((bitLen + 64) >>> 9) << 4) + 14] = bitLen;

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  const K = new Int32Array(64);
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
  }
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];

  const rotl = (x, n) => (x << n) | (x >>> (32 - n));
  for (let i = 0; i < words.length; i += 16) {
    let [aa, bb, cc, dd] = [a, b, c, d];
    for (let j = 0; j < 64; j++) {
      let f, g;
      if (j < 16) {
        f = (bb & cc) | (~bb & dd);
        g = j;
      } else if (j < 32) {
        f = (dd & bb) | (~dd & cc);
        g = (5 * j + 1) % 16;
      } else if (j < 48) {
        f = bb ^ cc ^ dd;
        g = (3 * j + 5) % 16;
      } else {
        f = cc ^ (bb | ~dd);
        g = (7 * j) % 16;
      }
      const tmp = dd;
      dd = cc;
      cc = bb;
      bb = (bb + rotl((aa + f + K[j] + (words[i + g] | 0)) | 0, S[j])) | 0;
      aa = tmp;
    }
    a = (a + aa) | 0;
    b = (b + bb) | 0;
    c = (c + cc) | 0;
    d = (d + dd) | 0;
  }

  return [a, b, c, d]
    .map((v) => {
      let hex = "";
      for (let i = 0; i < 4; i++) {
        hex += ((v >>> (i * 8)) & 0xff).toString(16).padStart(2, "0");
      }
      return hex;
    })
    .join("");
}

function parseArgs(raw) {
  const args = {};
  for (const pair of (typeof raw === "string" ? raw : "").split("&")) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const key = pair.slice(0, idx).trim();
    if (!key) continue;
    args[key] = decodeURIComponent(pair.slice(idx + 1).replace(/\+/g, " "));
  }
  return args;
}

function httpGet(url, headers = {}, timeout = 4) {
  return new Promise((resolve, reject) => {
    $httpClient.get(
      {
        url,
        headers,
        timeout,
        policy: "DIRECT",
        "auto-redirect": false,
      },
      (error, response, body) => {
        if (error) return reject(new Error("UNREACHABLE"));
        resolve({
          status: response ? Number(response.status) : 0,
          headers: (response && response.headers) || {},
          body: typeof body === "string" ? body : "",
        });
      }
    );
  });
}

function getHeaderCaseInsensitive(headers, target) {
  const lower = target.toLowerCase();
  for (const [k, v] of Object.entries(headers || {})) {
    if (k.toLowerCase() === lower) return String(v);
  }
  return "";
}

async function main() {
  const args = parseArgs(typeof $argument === "string" ? $argument : "");
  const mode = args.mode || "status";
  const targetSsid = args.ssid != null ? String(args.ssid).trim() : "Wi-Fi";
  const rawHost = (args.host || "192.168.1.1").trim().replace(/\/+$/, "");
  const user = (args.user || "admin").trim();
  const adminPwd = args.admin_pwd != null ? String(args.admin_pwd) : "admin";
  const showPwd = args.pwd !== "0";

  if (!/^(?:https?:\/\/)?[a-z0-9.-]+(?::\d{1,5})?$/i.test(rawHost) || !["status", "detail"].includes(mode)) {
    throw new Error("请检查模块参数中的 HOST 与 mode 配置");
  }

  const base = /^https?:\/\//i.test(rawHost) ? rawHost : `http://${rawHost}`;
  const hostNoProto = base.replace(/^https?:\/\//i, "");
  const hostIpMatch = hostNoProto.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
  const hostIp = hostIpMatch ? hostIpMatch[1] : "";

  function finishIdle() {
    if (mode === "status") {
      const hint =
        targetSsid && targetSsid !== "*"
          ? `连接热点「${targetSsid}」后自动刷新`
          : `连接随身 Wi-Fi (${hostNoProto}) 后刷新`;
      $done({
        title: "随身 Wi-Fi 未连接",
        content: hint,
        icon: "wifi.slash",
        "icon-color": COLORS.idle,
      });
    } else {
      $done({
        title: "热点详情待就绪",
        content: "当前未接入随身 Wi-Fi 网络",
        icon: "wifi.slash",
        "icon-color": COLORS.idle,
      });
    }
  }

  // 智能网络环境预检：兼顾 iOS SSID 识别、macOS 无定位权限时网关识别、以及 USB 共享模式
  const net = typeof $network === "object" && $network ? $network : {};
  const wifiSsid = net.wifi && net.wifi.ssid ? String(net.wifi.ssid).trim() : "";
  const routerIp = net.v4 && net.v4.primaryRouter ? String(net.v4.primaryRouter).trim() : "";
  const primaryIf = net.v4 && net.v4.primaryInterface ? String(net.v4.primaryInterface).trim() : "";

  if (!wifiSsid && !routerIp && /^pdp_ip/i.test(primaryIf)) {
    finishIdle();
    return;
  }
  if (targetSsid && targetSsid !== "*" && wifiSsid && wifiSsid !== targetSsid) {
    finishIdle();
    return;
  }
  if (!wifiSsid && hostIp && routerIp && routerIp !== hostIp) {
    finishIdle();
    return;
  }
  if (!wifiSsid && !routerIp && net.v4 && !net.v4.primaryAddress) {
    finishIdle();
    return;
  }

  const ssidConfirmed = Boolean(targetSsid && targetSsid !== "*" && wifiSsid && wifiSsid === targetSsid);

  // Digest 鉴权会话状态（仅当设备返回未授权时按需触发）
  let digestSession = null;
  let loginPromise = null;

  function buildDigestAuth(uri) {
    if (!digestSession) return {};
    const ncHex = digestSession.nc.toString(16).toUpperCase().padStart(8, "0");
    digestSession.nc++;
    const cnonce = md5(`${Math.floor(Math.random() * 100001)}${Date.now()}`).slice(0, 16);
    const ha1 = md5(`${user}:${digestSession.realm}:${adminPwd}`);
    const ha2 = md5(`GET:${uri}`);
    const response = md5(`${ha1}:${digestSession.nonce}:${ncHex}:${cnonce}:${digestSession.qop}:${ha2}`);
    return {
      cnonce,
      response,
      header: `Digest username="${user}", realm="${digestSession.realm}", nonce="${digestSession.nonce}", uri="${uri}", response="${response}", qop=${digestSession.qop}, nc=${ncHex}, cnonce="${cnonce}"`,
    };
  }

  async function ensureDigestLogin() {
    if (loginPromise) return loginPromise;
    loginPromise = (async () => {
      const ch = await httpGet(`${base}/login.cgi?_=${Date.now()}`, {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      });
      const wwwAuth = getHeaderCaseInsensitive(ch.headers, "WWW-Authenticate");
      const realm = (wwwAuth.match(/realm="([^"]+)"/i) || [])[1];
      const nonce = (wwwAuth.match(/nonce="([^"]+)"/i) || [])[1];
      const qop = (wwwAuth.match(/qop="([^"]+)"/i) || [])[1] || "auth";
      if (!realm || !nonce) throw new Error("AUTH_UNSUPPORTED");

      digestSession = { realm, nonce, qop, nc: 1 };
      const loginDigest = buildDigestAuth("/cgi/protected.cgi");
      // login.cgi 固定使用 nc=00000001 校验 response 参数
      const ha1 = md5(`${user}:${realm}:${adminPwd}`);
      const ha2 = md5("GET:/cgi/protected.cgi");
      const loginResHash = md5(`${ha1}:${nonce}:00000001:${loginDigest.cnonce}:${qop}:${ha2}`);
      const xmlAuth = buildDigestAuth("/cgi/xml_action.cgi");

      const loginUrl =
        `${base}/login.cgi?Action=Digest&username=${encodeURIComponent(user)}` +
        `&realm=${encodeURIComponent(realm)}&nonce=${encodeURIComponent(nonce)}` +
        `&response=${loginResHash}&qop=${encodeURIComponent(qop)}` +
        `&cnonce=${loginDigest.cnonce}&temp=marvell`;

      const res = await httpGet(loginUrl, { Authorization: xmlAuth.header });
      if (res.status !== 200 || !res.body.includes("200 OK")) {
        digestSession = null;
        throw new Error("AUTH_FAILED");
      }
    })();
    try {
      await loginPromise;
    } finally {
      loginPromise = null;
    }
  }

  function isAuthError(res) {
    if (res.status === 401 || res.status === 403) return true;
    return /\b(UNAUTHORIZED|KICKOFF)\b/i.test(res.body);
  }

  async function fetchJson(name, timeout = 3) {
    const makeUrl = () => `${base}/xml_action.cgi?method=get&module=duster&file=json_${name}${Date.now()}`;
    const makeHeaders = () => (digestSession ? { Authorization: buildDigestAuth("/cgi/xml_action.cgi").header } : {});

    let res = await httpGet(makeUrl(), makeHeaders(), timeout);
    if (isAuthError(res)) {
      await ensureDigestLogin();
      res = await httpGet(makeUrl(), makeHeaders(), timeout);
      if (isAuthError(res)) throw new Error("AUTH_FAILED");
    }
    if (res.status !== 200) throw new Error("BAD_STATUS");

    const start = res.body.indexOf("{");
    const end = res.body.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("INVALID_JSON");

    const data = JSON.parse(res.body.slice(start, end + 1));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("INVALID_JSON");
    if (String(data.msg || "").toLowerCase() === "api not found") throw new Error("API_NOT_FOUND");
    return data;
  }

  // ==================== 面板 1：实时状态 ====================
  if (mode === "status") {
    let status, home, eng, mss;
    try {
      [status, home, eng, mss] = await Promise.all([
        fetchJson("status_info", 4),
        fetchJson("homepage_info", 4).catch(() => null),
        fetchJson("engineering_info", 3).catch(() => null),
        fetchJson("mss_support_info", 3).catch(() => null),
      ]);
      if (status.signal_quality == null && status.rx_byte_all == null && status.battery_percent == null) {
        throw new Error("NOT_MIFI");
      }
    } catch (err) {
      // 若当前网关同样为 192.168.1.1（例如家庭 OpenWrt）且 macOS 未返回 SSID，静默显示未连接而非报错
      if (!ssidConfirmed && ["UNREACHABLE", "BAD_STATUS", "INVALID_JSON", "NOT_MIFI"].includes(err.message)) {
        finishIdle();
        return;
      }
      if (err.message === "AUTH_FAILED") {
        throw new Error("后台鉴权失败，请检查 USER / ADMIN_PWD 参数");
      }
      throw new Error("无法访问随身 Wi-Fi，请检查连接后刷新");
    }

    const carrier = home ? resolveCarrier(home.iccid, home.network_name) : "蜂窝网络";
    const radio = RADIO_MODE[String(status.sys_mode ?? "")] || "";
    const lte = parseLteMetrics(eng);
    const bandTag = lte && lte.band ? ` B${lte.band}` : "";
    const simInfo = parseSimSummary(mss);

    let problem = "";
    if (home) {
      if (home.sim_status != null && String(home.sim_status) !== "0") {
        problem = "SIM 卡未就绪";
      } else if (home.pin_status != null && String(home.pin_status) !== "0") {
        problem = PIN_ERROR[String(home.pin_status)] || "SIM 卡待解锁";
      } else if (home.connect_disconnect === "disabled") {
        problem = "蜂窝数据已关闭";
      } else if (numeric(status.signal_quality) === 0) {
        problem = "无蜂窝信号";
      } else if (String(status.sys_mode) === "0" || !home.wan_ip || home.wan_ip === "0.0.0.0") {
        problem = "蜂窝未连接";
      }
    }

    const rxBytes = numeric(status.rx_byte_all);
    const txBytes = numeric(status.tx_byte_all);
    const totalBytes = rxBytes != null && rxBytes >= 0 && txBytes != null && txBytes >= 0 ? rxBytes + txBytes : null;

    const sigBars = numeric(status.signal_quality);
    const sigMax = numeric(status.total_signal_quality) || 5;
    const barsText = sigBars != null && sigBars >= 0 ? `${sigBars}/${sigMax} 格` : "—";
    const rssi = numeric(status.rssi);
    const dbmVal = lte && lte.rsrp != null ? lte.rsrp : rssi != null && rssi < 0 ? rssi : null;
    const signalParts = [barsText];
    if (dbmVal != null) signalParts.push(`${dbmVal} dBm`);
    if (lte && lte.sinr != null) signalParts.push(`SINR ${lte.sinr} dB`);

    const hasBattery = String(status.battery_connect) !== "0";
    const isFull = String(status.battery_charge) === "2" || String(status.battery_charge) === "3";
    const isCharging = !isFull && (String(status.battery_charging) === "1" || String(status.battery_charge) === "1");
    const rawPct = numeric(status.battery_percent);
    const pct = isFull ? 100 : rawPct != null && rawPct >= 0 && rawPct <= 100 ? rawPct : null;
    const lowBattery = hasBattery && !isCharging && pct != null && pct <= 20;

    let batteryLine;
    if (!hasBattery) {
      batteryLine = "电量：USB 直供电（无电池）";
    } else {
      const stateTag = isFull ? "已充满" : isCharging ? "充电中" : lowBattery ? "电量偏低" : "电池供电";
      batteryLine = `电量：${pct != null ? `${pct}%` : "—"} · ${stateTag}`;
    }

    const clients = numeric(status.wifi_clients_num);
    const maxClients = home ? numeric(home.max_access_number) : null;
    const clientLabel =
      clients != null && clients >= 0
        ? maxClients && maxClients > 0
          ? `${clients}/${maxClients} 台`
          : `${clients} 台`
        : "—";

    const lines = [
      `速率：↓ ${formatSpeed(status.rx_speed)}   ↑ ${formatSpeed(status.tx_speed)}`,
      totalBytes != null
        ? `流量：${formatBytes(totalBytes)}（↓ ${formatCompactBytes(rxBytes)} · ↑ ${formatCompactBytes(txBytes)}）`
        : "流量：—",
      `信号：${signalParts.join(" · ")}`,
      batteryLine,
      `终端：${clientLabel} · 运行 ${formatUptime(status.run_seconds)}`,
    ];

    const alerts = [];
    if (String(status.roaming) === "1" || (home && String(home.roaming) === "1")) {
      alerts.push("漫游中");
    }
    const unreadSms = numeric(status.new_sms_num ?? status.new_sms);
    if (unreadSms != null && unreadSms > 0) {
      alerts.push(`未读短信 ${unreadSms} 条`);
    }
    if (alerts.length > 0) {
      lines.push(`提醒：${alerts.join(" · ")}`);
    }

    const titleParts = [`${carrier}${radio ? ` ${radio}${bandTag}` : ""}`];
    if (problem) {
      titleParts.push(problem);
    } else if (simInfo && simInfo.activeLabel) {
      titleParts.push(simInfo.activeLabel);
    }

    const weakSignal = (sigBars != null && sigBars <= 1) || (lte && lte.rsrp != null && lte.rsrp <= -110);
    const iconColor = problem
      ? COLORS.error
      : lowBattery || weakSignal || alerts.length > 0
        ? COLORS.warning
        : COLORS.online;

    $done({
      title: titleParts.join(" · "),
      content: lines.join("\n"),
      icon: problem ? "exclamationmark.triangle.fill" : "antenna.radiowaves.left.and.right",
      "icon-color": iconColor,
    });
    return;
  }

  // ==================== 面板 2：热点与设备详情 ====================
  let home, security, wlan, pdp, eng, mss;
  try {
    [home, security, wlan] = await Promise.all([
      fetchJson("homepage_info", 4),
      fetchJson("wlan_security_info", 4).catch(() => null),
      fetchJson("wlan_info", 3).catch(() => null),
    ]);
    [pdp, eng, mss] = await Promise.all([
      fetchJson("wan_pdp_context_info", 3).catch(() => null),
      fetchJson("engineering_info", 3).catch(() => null),
      fetchJson("mss_support_info", 3).catch(() => null),
    ]);
    if (!home.lan_ip && !home.ssid && !home.imei) {
      throw new Error("NOT_MIFI");
    }
  } catch (err) {
    if (!ssidConfirmed && ["UNREACHABLE", "BAD_STATUS", "INVALID_JSON", "NOT_MIFI"].includes(err.message)) {
      finishIdle();
      return;
    }
    if (err.message === "AUTH_FAILED") {
      throw new Error("后台鉴权失败，请检查 USER / ADMIN_PWD 参数");
    }
    throw new Error("无法读取设备详情，请检查连接后刷新");
  }

  const ssidName = decodeUniHex((security && security.ssid) || home.ssid);
  const wifiOff = String(home.wlan_enable) === "0" || (wlan && String(wlan.wlan_enable) === "0");
  const channelNum = wlan ? numeric(wlan.channel) : null;
  const wifiBand = wlan && (String(wlan.rf_band) === "2" || (channelNum && channelNum > 14)) ? "5G" : "2.4G";
  const chText = channelNum && channelNum > 0 ? `CH${channelNum}` : "自动信道";
  const wifiBw = wlan ? (String(wlan.bandwidth) === "2" ? "40MHz" : String(wlan.bandwidth) === "1" ? "20MHz" : "") : "";

  const secMode = (security && security.mode) || "";
  const secLabel = security ? WIFI_SECURITY[secMode] || cleanText(secMode, "加密") : "未知";
  const lines = [];

  if (showPwd) {
    if (!security) {
      lines.push("密码：读取失败");
    } else if (["Open", "None", ""].includes(secMode)) {
      lines.push("安全：开放网络（无需密码）");
    } else {
      const secObj = security[secMode];
      const wifiKey = secObj && (secMode === "WEP" ? secObj.key1 : secObj.key || secObj.key1);
      lines.push(`密码：${cleanText(wifiKey)} · ${secLabel}`);
    }
  } else {
    const hiddenTag = security && String(security.ssid_bcast) === "0" ? "隐藏 SSID" : "广播开启";
    lines.push(`安全：${secLabel} · ${hiddenTag}`);
  }

  const activePdp =
    pdp && Array.isArray(pdp.pdp_context_list)
      ? pdp.pdp_context_list.find((item) => String(item.success) === "1") || pdp.pdp_context_list[0]
      : null;
  const rawWanIp = (activePdp && activePdp.ipv4) || home.wan_ip || "";
  const wanIp = rawWanIp && rawWanIp !== "0.0.0.0" ? rawWanIp : "";
  const ipv6Ready = activePdp ? hasValidGlobalIPv6(activePdp.g_ipv6) : false;
  lines.push(wanIp ? `出口：${wanIp} · ${ipv6Ready ? "IPv6 已就绪" : "仅 IPv4"}` : "出口：蜂窝未拨号");

  const simInfo = parseSimSummary(mss);
  if (simInfo && simInfo.slotsLine) {
    lines.push(`卡槽：${simInfo.slotsLine}`);
  } else if (home.iccid) {
    const iccid = String(home.iccid).trim();
    const masked = iccid.length > 10 ? `${iccid.slice(0, 6)}…${iccid.slice(-4)}` : iccid;
    lines.push(`卡号：${masked}`);
  }

  const lte = parseLteMetrics(eng);
  if (lte) {
    const rfParts = [];
    if (lte.band) rfParts.push(`B${lte.band}${lte.bw ? ` ${lte.bw}` : ""}`);
    if (lte.pci) rfParts.push(`PCI ${lte.pci}`);
    if (lte.rsrq != null) rfParts.push(`RSRQ ${lte.rsrq} dB`);
    else if (lte.earfcn) rfParts.push(`频点 ${lte.earfcn}`);
    if (rfParts.length > 0) lines.push(`工参：${rfParts.join(" · ")}`);
  }

  const model = cleanText(home.device_name || home.device_model || home.hw_version, "");
  const adminAddr = cleanText(home.lan_ip, hostNoProto);
  lines.push(`后台：${adminAddr}${model ? ` · 型号 ${model}` : ""}`);

  const detailTitle = wifiOff
    ? `${ssidName} · Wi-Fi 已关闭`
    : `${ssidName} · ${wifiBand} ${chText}${wifiBw ? ` (${wifiBw})` : ""}`;

  $done({
    title: detailTitle,
    content: lines.join("\n"),
    icon: wifiOff ? "wifi.exclamationmark" : "wifi",
    "icon-color": wifiOff || !wanIp ? COLORS.warning : COLORS.detail,
  });
}

main().catch((error) => {
  $done({
    title: "随身 Wi-Fi 读取失败",
    content: error instanceof URIError ? "模块参数编码有误，请检查配置" : cleanText(error && error.message, "未知错误"),
    icon: "exclamationmark.octagon.fill",
    "icon-color": COLORS.error,
  });
});
