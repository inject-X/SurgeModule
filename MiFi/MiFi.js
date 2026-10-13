/*
 * 随身WiFi 面板 for Surge(实时状态 + 设备详情)
 * 仅在连接指定 Wi-Fi(默认 leshi)时显示数据
 * argument: mode=status|detail&ssid=leshi&host=192.168.1.1&pwd=1
 */

const args = {};
($argument || "").split("&").forEach((s) => {
  const i = s.indexOf("=");
  if (i > 0) args[s.slice(0, i)] = decodeURIComponent(s.slice(i + 1));
});
const clean = (v, d) => (!v || /\{\{\{.*\}\}\}/.test(v) ? d : v);
const MODE = clean(args.mode, "status");
const TARGET_SSID = clean(args.ssid, "leshi");
const HOST = clean(args.host, "192.168.1.1");
const SHOW_PWD = clean(args.pwd, "1") === "1";

const base = `http://${HOST}/xml_action.cgi?method=get&module=duster&file=`;

function get(name) {
  return new Promise((resolve) => {
    $httpClient.get(
      { url: base + name + Date.now(), timeout: 5, policy: "DIRECT" },
      (err, resp, data) => {
        if (err || !data) return resolve(null);
        try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
      }
    );
  });
}

// ---------- 工具函数 ----------
const n = (v) => Number(v) || 0;

function fmtBytes(b) {
  b = n(b);
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return (i === 0 ? b.toFixed(0) : b.toFixed(b >= 100 ? 0 : 2)) + " " + u[i];
}
const fmtSpeed = (b) => fmtBytes(b) + "/s";

function fmtTime(sec) {
  sec = n(sec);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d ? `${d}天${h}时` : h ? `${h}时${m}分` : `${m}分`;
}

function bar(p, len = 10) {
  const f = Math.round((Math.max(0, Math.min(100, p)) / 100) * len);
  return "█".repeat(f) + "░".repeat(len - f);
}

function signalBars(q) {
  q = Math.max(0, Math.min(5, n(q)));
  const lv = ["▁", "▃", "▅", "▇", "█"];
  return lv.map((c, i) => (i < q ? c : "·")).join("");
}

// SSID 为 UTF-16BE 十六进制,如 006c0065... => le...
function decodeSSID(s) {
  if (!s || !/^([0-9a-fA-F]{4})+$/.test(s)) return s || "";
  let out = "";
  for (let i = 0; i < s.length; i += 4) out += String.fromCharCode(parseInt(s.substr(i, 4), 16));
  return out;
}

const CARRIER = {
  "CHN TELECOM": "中国电信", "CHN-TELECOM": "中国电信", "CHINA TELECOM": "中国电信", "CHN-CT": "中国电信",
  "CHN-UNICOM": "中国联通", "CHN UNICOM": "中国联通", "CHINA UNICOM": "中国联通",
  "CHINA MOBILE": "中国移动", "CMCC": "中国移动",
};
// sys_mode 对应关系为推测值,如与实际不符可自行调整
const SYS_MODE = { "0": "无服务", "3": "2G", "5": "3G", "9": "3G", "15": "3G", "17": "4G", "19": "4G", "22": "5G", "23": "5G" };

// ---------- 实时状态 ----------
async function statusPanel() {
  const [st, hp] = await Promise.all([get("json_status_info"), get("json_homepage_info")]);
  if (!st) return fail();

  const pct = n(st.battery_percent);
  const charging = st.battery_charging === "1";
  const sigQ = n(st.signal_quality);
  const mode = SYS_MODE[st.sys_mode] || "";
  const maxClients = hp && hp.max_access_number ? `/${hp.max_access_number}` : "";

  const L = [];
  L.push(`🔋 ${bar(pct)} ${pct}%${charging ? "  ⚡充电中" : st.battery_connect === "0" ? "  🔌无电池" : ""}`);
  L.push(`📶 ${signalBars(sigQ)} ${sigQ}/5 · ${st.rssi}dBm${mode ? " · " + mode : ""}`);
  if (hp) {
    const cname = hp.network_name || "";
    const carrier = CARRIER[cname.toUpperCase()] || cname || "未知网络";
    L.push(`🌐 ${carrier} · ${hp.wan_ip || "无 IP"}`);
  }
  L.push(`⬆️ ${fmtSpeed(st.tx_speed)}    ⬇️ ${fmtSpeed(st.rx_speed)}`);
  L.push(`🚀 峰值 ↑${fmtSpeed(st.tx_max_speed)}  ↓${fmtSpeed(st.rx_max_speed)}`);
  L.push(`📊 累计 ↑${fmtBytes(st.tx_byte_all)}  ↓${fmtBytes(st.rx_byte_all)}`);
  L.push(`👥 ${st.wifi_clients_num}${maxClients} 台设备 · ⏱ ${fmtTime(st.run_seconds)}`);
  if (n(st.new_sms_num) > 0) L.push(`✉️ ${st.new_sms_num} 条新短信`);
  if (st.roaming === "1") L.push(`🌍 漫游中,注意资费`);

  const color = charging || pct > 50 ? "#34C759" : pct > 20 ? "#FF9F0A" : "#FF3B30";
  $done({
    title: `随身WiFi · 实时${hp && hp.device_name ? " · " + hp.device_name : ""}`,
    content: L.join("\n"),
    icon: charging ? "battery.100.bolt" : pct > 75 ? "battery.100" : pct > 50 ? "battery.75" : pct > 25 ? "battery.50" : "battery.25",
    "icon-color": color,
  });
}

// ---------- 设备详情 ----------
async function detailPanel() {
  const [hp, sec] = await Promise.all([
    get("json_homepage_info"),
    SHOW_PWD ? get("json_wlan_security_info") : Promise.resolve(null),
  ]);
  if (!hp) return fail();

  const L = [];
  const name = decodeSSID(hp.ssid) || TARGET_SSID;
  L.push(`📡 Wi-Fi: ${name}${hp.wlan_enable === "0" ? "(已关闭)" : ""}`);
  if (SHOW_PWD && sec) {
    const key = sec[sec.mode] && sec[sec.mode].key;
    if (key) L.push(`🔑 密码: ${key}`);
  }
  L.push(`📱 型号: ${hp.device_name || "-"}`);
  L.push(`🧩 固件: ${hp.sw_version || "-"}`);
  L.push(`🔢 序列号: ${hp.serial_number || "-"}`);
  L.push(`🏷 MAC: ${hp.mac || "-"}`);
  L.push(`🏠 后台: ${hp.lan_domain || hp.lan_ip} (${hp.lan_ip || HOST})`);
  const simOk = hp.sim_status === "0" && hp.pin_status === "0";
  L.push(`💳 SIM: ${simOk ? "正常" : `异常(sim=${hp.sim_status}, pin=${hp.pin_status})`} · 联网: ${hp.connect_disconnect === "cellular" ? "蜂窝" : hp.connect_disconnect || "-"}`);

  $done({
    title: "随身WiFi · 设备详情",
    content: L.join("\n"),
    icon: "wifi.router.fill",
    "icon-color": simOk ? "#0A84FF" : "#FF9F0A",
  });
}

function fail() {
  $done({
    title: "随身WiFi",
    content: `⚠️ 无法获取设备信息\n请确认 ${HOST} 可访问`,
    icon: "exclamationmark.triangle.fill",
    "icon-color": "#FF9500",
  });
}

// ---------- 入口 ----------
(async () => {
  const ssid = ($network.wifi && $network.wifi.ssid) || "";
  if (ssid !== TARGET_SSID) {
    return $done({
      title: MODE === "detail" ? "随身WiFi · 设备详情" : "随身WiFi · 实时",
      content: `📵 未连接「${TARGET_SSID}」\n当前网络: ${ssid || "非 Wi-Fi / 未连接"}`,
      icon: "antenna.radiowaves.left.and.right.slash",
      "icon-color": "#8E8E93",
    });
  }
  MODE === "detail" ? await detailPanel() : await statusPanel();
})();
