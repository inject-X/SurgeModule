/* Surge 原生 MiFi 双面板。argument: mode=status|detail&ssid=leshi&host=192.168.100.1&pwd=1 */

const colors = { online: "#087E8B", detail: "#647D8E", warning: "#AD6500", error: "#C54848", idle: "#697386" };

function numeric(value) {
  if (value == null || String(value).trim() === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function text(value) {
  return value == null || value === "" ? "—" : String(value).replace(/[\r\n\t]/g, " ");
}

function size(value) {
  let amount = numeric(value);
  if (amount == null || amount < 0) return "—";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit++;
  }
  return `${amount.toFixed(unit === 0 ? 0 : unit >= 3 ? 2 : 1)} ${units[unit]}`;
}

function speed(value) {
  const result = size(value);
  return result === "—" ? result : `${result}/s`;
}

function uptime(value) {
  const seconds = numeric(value);
  if (seconds == null || seconds < 0) return "—";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return "不足 1 分";
  if (minutes < 60) return `${minutes} 分`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 时 ${minutes % 60} 分`;
  return `${Math.floor(minutes / 1440)} 天 ${Math.floor(minutes / 60) % 24} 时`;
}

function decodeSSID(value) {
  if (typeof value !== "string" || !/^(?:[0-9a-f]{4})+$/i.test(value)) return text(value);
  return text(value.replace(/.{4}/g, unit => String.fromCharCode(parseInt(unit, 16))));
}

async function main() {
  const args = {};
  for (const pair of (typeof $argument === "string" ? $argument : "").split("&")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    args[pair.slice(0, separator)] = decodeURIComponent(pair.slice(separator + 1).replace(/\+/g, " "));
  }
  const mode = args.mode || "status";
  const ssid = args.ssid || "leshi";
  const host = (args.host || "192.168.100.1").replace(/\/+$/, "");
  if (!/^(?:https?:\/\/)?[a-z0-9.-]+(?::\d{1,5})?$/i.test(host) || !["status", "detail"].includes(mode)) {
    throw new Error("检查模块的 HOST 和 mode 参数");
  }
  if (typeof $network === "undefined" || !$network.wifi || $network.wifi.ssid !== ssid) {
    $done({ title: "MiFi 未连接", content: `连接 ${text(ssid)} 后刷新面板`, icon: "wifi.slash", "icon-color": colors.idle });
    return;
  }

  const base = /^https?:\/\//i.test(host) ? host : `http://${host}`;
  function request(name) {
    return new Promise((resolve, reject) => {
      $httpClient.get({
        url: `${base}/xml_action.cgi?method=get&module=duster&file=json_${name}${Date.now()}`,
        timeout: 4,
        policy: "DIRECT",
        "auto-redirect": false,
      }, (error, response, body) => {
        if (error) return reject(new Error("无法访问设备，请检查连接后刷新"));
        if (response && [401, 403].includes(Number(response.status))) return reject(new Error("请先登录设备后台，再刷新面板"));
        if (!response || Number(response.status) !== 200) return reject(new Error("设备接口暂不可用，请稍后刷新"));
        if (/^\s*(UNAUTHORIZED|KICKOFF)\s*$/.test(body)) return reject(new Error("请先登录设备后台，再刷新面板"));
        try {
          const data = JSON.parse(body);
          const fields = { status_info: ["rx_speed", "signal_quality", "wifi_clients_num"], homepage_info: ["device_name", "ssid", "connect_disconnect"], wlan_security_info: ["mode"] };
          if (!data || typeof data !== "object" || Array.isArray(data) || !fields[name].some(field => Object.prototype.hasOwnProperty.call(data, field))) {
            throw new Error("invalid response");
          }
          resolve(data);
        } catch (_) {
          reject(new Error("设备返回异常，请登录后台后刷新"));
        }
      });
    });
  }

  if (mode === "status") {
    const [status, home] = await Promise.all([request("status_info"), request("homepage_info").catch(() => null)]);
    const carrier = home && ({ "CHN TELECOM": "中国电信", "CHN MOBILE": "中国移动", "CHINA MOBILE": "中国移动", "CHN UNICOM": "中国联通", "CHINA UNICOM": "中国联通" }[home.network_name] || text(home.network_name));
    // 此设备 /js/base.js 的映射：17=4G，5/15=3G，3=GSM。
    const radio = { "17": "4G", "5": "3G", "15": "3G", "3": "GSM" }[status.sys_mode];
    let problem = "";
    if (home) {
      if (home.sim_status != null && home.sim_status !== "0") problem = "SIM 卡不可用";
      else if (home.pin_status != null && home.pin_status !== "0") problem = "SIM 卡待解锁";
      else if (home.connect_disconnect === "disabled") problem = "蜂窝已关闭";
      else if (numeric(status.signal_quality) === 0) problem = "无蜂窝信号";
      else if (String(status.sys_mode) === "0" || home.wan_ip === "" || home.wan_ip === "0.0.0.0") problem = "蜂窝未连接";
    }
    const received = numeric(status.rx_byte_all);
    const transmitted = numeric(status.tx_byte_all);
    const total = received != null && received >= 0 && transmitted != null && transmitted >= 0 ? received + transmitted : null;
    const signal = numeric(status.signal_quality);
    const maxSignal = numeric(status.total_signal_quality);
    const signalLabel = signal != null && maxSignal > 0 && signal >= 0 && signal <= maxSignal ? `${signal}/${maxSignal}` : "—";
    const rssi = numeric(status.rssi);
    const percent = numeric(status.battery_percent);
    const battery = percent != null && percent >= 0 && percent <= 100 ? `${percent}%` : "—";
    const charging = status.battery_charging === "1" || status.battery_charge === "1";
    const hasBattery = status.battery_connect !== "0";
    const lowBattery = hasBattery && percent != null && percent >= 0 && percent <= 20;
    const clients = numeric(status.wifi_clients_num);
    const lines = [
      `↓ ${speed(status.rx_speed)}    ↑ ${speed(status.tx_speed)}`,
      `累计流量 ${size(total)}`,
      "",
      `信号 ${signalLabel}${rssi != null && rssi < 0 ? `    ${rssi} dBm` : ""}`,
      `电量 ${hasBattery ? battery : "未安装电池"}${hasBattery && charging ? "  充电中" : lowBattery ? "  电量偏低" : ""}`,
      `已接入 ${clients != null && clients >= 0 ? `${clients} 台` : "—"}`,
    ];
    if (!home) lines.push("网络信息暂不可用");
    else if (home.roaming === "1" || status.roaming === "1") lines.push("当前正在漫游");
    $done({
      title: problem || (home ? `${carrier === "—" ? "蜂窝网络" : carrier}  ${radio || "制式未知"}` : "MiFi 状态"),
      content: lines.join("\n"),
      icon: "antenna.radiowaves.left.and.right",
      "icon-color": problem || !home || lowBattery || (signal != null && signal <= 1) ? colors.warning : colors.online,
    });
    return;
  }

  const [home, status, security] = await Promise.all([
    request("homepage_info"),
    request("status_info").catch(() => null),
    request("wlan_security_info").catch(() => null),
  ]);
  const lines = [];
  const securityMode = security && security.mode;
  const encryption = { Mixed: "WPA / WPA2", "WPA2-WPA3": "WPA2 / WPA3", "WPA2-PSK": "WPA2", "WPA-PSK": "WPA", "WPA3-SAE": "WPA3", "WAPI-PSK": "WAPI", Open: "开放网络", None: "开放网络" };
  if (args.pwd === "1") {
    const active = security && security[securityMode];
    const password = active && (active.key || active.key1);
    lines.push(`密码 ${security ? password ? text(password) : ["Open", "None"].includes(securityMode) ? "无需密码" : "不可用" : "读取失败，请登录后台"}`);
  }
  lines.push(`加密 ${security ? encryption[securityMode] || text(securityMode) : "读取失败"}`, "", `设备 ${text(home.device_name || home.device_model || home.hw_version)}`, `后台 ${text(home.lan_ip || host)}`, `运行 ${uptime(status && status.run_seconds)}`);
  if (home.wlan_enable === "0") lines.push("Wi-Fi 已关闭");
  $done({
    title: decodeSSID((security && security.ssid) || home.ssid),
    content: lines.join("\n"),
    icon: "wifi",
    "icon-color": !security || home.wlan_enable === "0" ? colors.warning : colors.detail,
  });
}

main().catch(error => $done({ title: "MiFi 读取失败", content: error instanceof URIError ? "SSID 参数编码有误，请检查模块参数" : error.message, icon: "exclamationmark.circle", "icon-color": colors.error }));
