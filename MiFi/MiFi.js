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

// 彩色方块进度条(面板文字无法单独着色,用 emoji 方块才有颜色)
function colorBar(p, len = 10) {
  p = Math.max(0, Math.min(100, p));
  const f = Math.round((p / 100) * len);
  const c = p > 50 ? "🟩" : p > 20 ? "🟨" : "🟥";
  return c.repeat(f) + "⬜".repeat(len - f);
}

function signalBar(q) {
  q = Math.max(0, Math.min(5, n(q)));
  const c = q >= 4 ? "🟩" : q >= 2 ? "🟨" : "🟥";
  return c.repeat(q) + "⬜".repeat(5 - q);
}

// 固件版本只取末尾 V004 这一段,避免换行
const shortFw = (v) => ((v || "").match(/V\d+\w*$/i) || [v || "-"])[0];

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

  const cname = (hp && hp.network_name) || "";
  const carrier = CARRIER[cname.toUpperCase()] || cname || "未知网络";

  const L = [];
  L.push(`🔋 ${colorBar(pct, 5)} ${pct}%${charging ? " ⚡" : ""}`);
  L.push(`📶 ${signalBar(sigQ)} ${st.rssi}dBm`);
  L.push(`🌐 ${carrier}${mode ? " · " + mode : ""}`);
  L.push("");
  L.push(`⬆️ ${fmtSpeed(st.tx_speed)}   ⬇️ ${fmtSpeed(st.rx_speed)}`);
  L.push(`📊 ↑${fmtBytes(st.tx_byte_all)}   ↓${fmtBytes(st.rx_byte_all)}`);
  L.push(`👥 ${st.wifi_clients_num}${maxClients} 台 · ⏱ ${fmtTime(st.run_seconds)}`);
  if (n(st.new_sms_num) > 0) L.push(`✉️ ${st.new_sms_num} 条新短信`);
  if (st.roaming === "1") L.push(`🌍 漫游中,注意资费`);

  const color = charging || pct > 50 ? "#34C759" : pct > 20 ? "#FF9F0A" : "#FF3B30";
  $done({
    title: `随身WiFi · ${hp && hp.device_name ? hp.device_name : "实时"}${mode ? " · " + mode : ""}`,
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
  const key = SHOW_PWD && sec && sec[sec.mode] && sec[sec.mode].key;
  L.push(`📡 ${name}${hp.wlan_enable === "0" ? "(已关闭)" : ""}${key ? "  🔑 " + key : ""}`);
  L.push("");
  L.push(`📱 ${hp.device_name || "-"} · ${shortFw(hp.sw_version)}`);
  L.push(`🔢 ${hp.serial_number || "-"}`);
  L.push(`🏷 ${hp.mac || "-"}`);
  L.push("");
  L.push(`🌐 ${hp.wan_ip || "无 IP"}`);
  L.push(`🏠 ${hp.lan_domain || hp.lan_ip || HOST}`);
  const simOk = hp.sim_status === "0" && hp.pin_status === "0";
  L.push(`💳 SIM ${simOk ? "正常" : `异常(${hp.sim_status}/${hp.pin_status})`}`);

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
