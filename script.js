

const form = document.getElementById("search-form");
const input = document.getElementById("search-input");
const button = form.querySelector("button");
const errorBox = document.getElementById("search-error");
const infoCard = document.querySelector(".info");

const els = {
  ip: document.getElementById("ip"),
  location: document.getElementById("location"),
  timezone: document.getElementById("timezone"),
  isp: document.getElementById("isp"),
};

const map = L.map("map", { zoomControl: false }).setView([40.65, -73.95], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const markerIcon = L.icon({
  iconUrl: "images/icon-location.svg",
  iconSize: [46, 56],
  iconAnchor: [23, 56],
});

let marker = null;

function updateMap(lat, lng) {
  const latLng = [lat, lng];
  if (marker) marker.setLatLng(latLng);
  else marker = L.marker(latLng, { icon: markerIcon }).addTo(map);

  map.setView(latLng, 13, { animate: false });
 
  const overlap = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--card-overlap"), 10) || 0;
  const cardBottom = infoCard.offsetHeight - overlap;
  map.panBy([0, -cardBottom / 2], { animate: false });
}


const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^[0-9a-f:]+$/i;
const DOMAIN = /^(?!-)([a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/i;

function cleanQuery(raw) {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#]/)[0];
}

const isIP = (q) => IPV4.test(q) || (q.includes(":") && IPV6.test(q));


async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function resolveDomain(domain) {
  const data = await getJSON(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`);
  const record = (data.Answer || []).find((a) => a.type === 1);
  if (!record) throw new Error("Bu domain için IP adresi bulunamadı.");
  return record.data;
}

async function fromIpwhois(ip) {
  const d = await getJSON(`https://ipwho.is/${ip}`);
  if (!d.success) throw new Error(d.message || "Geçersiz IP adresi.");
  return {
    ip: d.ip,
    city: d.city,
    region: d.region_code || d.region,
    postal: d.postal,
    utc: d.timezone && d.timezone.utc,
    isp: (d.connection && (d.connection.isp || d.connection.org)) || "",
    lat: d.latitude,
    lng: d.longitude,
  };
}

async function fromIpapi(ip) {
  const d = await getJSON(`https://ipapi.co/${ip ? ip + "/" : ""}json/`);
  if (d.error) throw new Error(d.reason || "Geçersiz IP adresi.");
  const off = d.utc_offset || ""; // "-0500"
  return {
    ip: d.ip,
    city: d.city,
    region: d.region_code || d.region,
    postal: d.postal,
    utc: off ? `${off.slice(0, 3)}:${off.slice(3)}` : "",
    isp: d.org || "",
    lat: d.latitude,
    lng: d.longitude,
  };
}

async function lookup(ip = "") {
  try {
    return await fromIpwhois(ip);
  } catch (err) {
    console.warn("ipwho.is başarısız, ipapi.co deneniyor:", err.message);
    return fromIpapi(ip);
  }
}


function render(d) {
  els.ip.textContent = d.ip || "—";
  const region = [d.region, d.postal].filter(Boolean).join(" ");
  els.location.textContent = [d.city, region].filter(Boolean).join(", ") || "—";
  els.timezone.textContent = d.utc ? `UTC ${d.utc}` : "—";
  els.isp.textContent = d.isp || "—";
  if (typeof d.lat === "number" && typeof d.lng === "number") updateMap(d.lat, d.lng);
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.hidden = !msg;
  form.classList.toggle("is-error", Boolean(msg));
}

function setLoading(on) {
  button.disabled = on;
  infoCard.classList.toggle("is-loading", on);
}

async function search(query) {
  showError("");
  setLoading(true);
  try {
    let ip = "";
    if (query) {
      const q = cleanQuery(query);
      if (isIP(q)) ip = q;
      else if (DOMAIN.test(q)) ip = await resolveDomain(q);
      else throw new Error("Lütfen geçerli bir IP adresi veya domain girin.");
    }
    render(await lookup(ip));
  } catch (err) {
    showError(err.message || "Bir hata oluştu, tekrar deneyin.");
  } finally {
    setLoading(false);
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = input.value.trim();
  if (!value) return showError("Lütfen bir IP adresi veya domain girin.");
  search(value);
});

input.addEventListener("input", () => showError(""));


search("");
