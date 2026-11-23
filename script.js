
const WORKER_URL = "";

const COINS = [
  {id:"BTC",name:"Bitcoin",c:"#f7931a",cg:"bitcoin"},{id:"ETH",name:"Ethereum",c:"#627eea",cg:"ethereum"},
  {id:"DOGE",name:"Dogecoin",c:"#c2a633",cg:"dogecoin"},{id:"SOL",name:"Solana",c:"#14a085",cg:"solana"},
  {id:"POL",name:"Polygon",c:"#8247e5",cg:"polygon-ecosystem-token"},{id:"LTC",name:"Litecoin",c:"#5c6f8f",cg:"litecoin"},
  {id:"BNB",name:"BNB",c:"#d4a017",cg:"binancecoin"},{id:"TRX",name:"TRON",c:"#d6403a",cg:"tron"},
  {id:"XRP",name:"XRP",c:"#3d6f9e",cg:"ripple"},{id:"ALGO",name:"Algorand",c:"#2e2e3a",cg:"algorand"},
  {id:"USDC",name:"USD Coin",c:"#2775ca",fixed:1},{id:"RLT",name:"RLT",c:"#e2457d",fixed:1}
];
const U = {"Gh/s":1,"Th/s":1e3,"Ph/s":1e6,"Eh/s":1e9,"Zh/s":1e12};
const $ = id => document.getElementById(id);
const f = $("f"), sel = $("addCoin");
let PRICES = {};
const added = () => COINS.filter(k => $("card-" + k.id));

function refresh() {
  const left = COINS.filter(k => !$("card-" + k.id));
  sel.innerHTML = `<option value="">Add a coin...</option>` + left.map(k => `<option value="${k.id}">${k.id} - ${k.name}</option>`).join("");
  $("empty").hidden = added().length > 0;
}
function fillPrice(k) {
  const i = $(k.id + "-p");
  if (i && !k.fixed && !i.dataset.edited && PRICES[k.id]) i.value = PRICES[k.id];
}
function addCoin(id) {
  const k = COINS.find(c => c.id === id);
  if (!k || $("card-" + id)) return;
  const n = (s, ph, extra = "") => `<input id="${id}-${s}" type="number" min="0" step="any" inputmode="decimal" placeholder="${ph}" ${extra}>`;
  const d = document.createElement("div");
  d.className = "coin"; d.id = "card-" + id; d.style.setProperty("--c", k.c);
  d.innerHTML = `<h3>${k.id} <span class="nm">${k.name}</span><button type="button" class="rm" data-id="${id}" aria-label="Remove ${k.name}">Remove</button></h3>
<div class="grid">
<label>Price (USD)${k.fixed ? " - fixed" : ""}${n("p", "Price in USD", k.fixed ? 'value="1" readonly' : "")}</label>
<label>Block reward${n("r", "Coins per block")}</label>
<label>League power<span class="pw">${n("l", "League power")}<select id="${id}-u" aria-label="League power unit">${Object.keys(U).map(u => `<option${u === "Ph/s" ? " selected" : ""}>${u}</option>`).join("")}</select></span></label>
<label>Block time (seconds)${n("t", "Seconds per block")}</label>
<label class="mine">My power on this coin (same unit)${n("m", "My power")}</label>
</div>`;
  $("coins").appendChild(d);
  const p = $(id + "-p"); if (p) p.addEventListener("input", () => p.dataset.edited = "1");
  fillPrice(k); refresh();
}
sel.addEventListener("change", () => { if (sel.value) addCoin(sel.value); });
$("coins").addEventListener("click", e => { const b = e.target.closest(".rm"); if (b) { $("card-" + b.dataset.id).remove(); refresh(); } });
f.addEventListener("change", () => f.classList.toggle("yes", f.has.value === "yes"));
refresh();

const ids = COINS.filter(k => k.cg).map(k => k.cg).join(",");
const cg = ' Prices by <a href="https://www.coingecko.com/">CoinGecko</a>. You can edit any price.';
fetch("https://api.coingecko.com/api/v3/simple/price?ids=" + ids + "&vs_currencies=usd")
  .then(r => r.json()).then(d => {
    COINS.forEach(k => { if (k.cg && d[k.cg] && d[k.cg].usd) PRICES[k.id] = d[k.cg].usd; });
    added().forEach(fillPrice);
    $("priceNote").innerHTML = Object.keys(PRICES).length ? "Live prices loaded." + cg : "Could not load live prices. Enter prices yourself.";
  }).catch(() => { $("priceNote").textContent = "Could not load live prices. Enter prices yourself."; });

const fmt = gh => { const u = Object.entries(U).reverse().find(([, v]) => gh >= v) || ["Gh/s", 1]; return (gh / u[1]).toFixed(2).replace(/\.?0+$/, "") + " " + u[0]; };
const usd = n => "$" + n.toFixed(n < 1 ? 4 : 2);

f.addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("err"), btn = $("go"); err.textContent = "";
  if (!WORKER_URL) { err.textContent = "The calculator is not connected yet. Add your Worker URL in script.js."; return; }
  const total = +$("total").value * U[$("totalUnit").value];
  if (!(total > 0)) { err.textContent = "Enter your total power first."; return; }
  const yes = f.has.value === "yes", coins = [];
  for (const k of added()) {
    const v = s => +$(k.id + "-" + s).value, u = U[$(k.id + "-u").value];
    const [p, r, l, t] = [v("p"), v("r"), v("l"), v("t")];
    if (![p, r, l, t].every(n => n > 0)) { err.textContent = `${k.id}: fill in price, block reward, league power and block time, or remove the coin.`; return; }
    const m = yes ? v("m") : 0;
    if (m < 0 || m >= l) { err.textContent = `${k.id}: your power must be lower than the league power.`; return; }
    coins.push({ id: k.id, price: p, reward: r, blockSec: t, others: (l - m) * u, mine: m * u });
  }
  if (!coins.length) { err.textContent = "Add at least one coin."; return; }
  btn.disabled = true; setTimeout(() => btn.disabled = false, 3000);
  try {
    const res = await fetch(WORKER_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ total, coins }) });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Request failed");
    show(d, total);
  } catch (x) { err.textContent = "Could not calculate: " + x.message; }
});

function show(d, total) {
  const rows = d.allocations.map(a => ({ ...a, k: COINS.find(c => c.id === a.id) }));
  const blocks = []; let acc = 0;
  rows.forEach(r => { acc += r.power / total * 40; while (blocks.length < Math.round(acc)) blocks.push(r.k.c); });
  while (blocks.length < 40) blocks.push(rows[rows.length - 1].k.c);
  const cmp = d.current != null ? `<p>Your current split earns about ${usd(d.current)} per day, so the new split changes it by ${usd(d.total - d.current)} per day.</p>` : "";
  $("out").hidden = false;
  $("out").innerHTML = `<h2>Best split</h2><p class="big">${usd(d.total)} / day</p>${cmp}
  <div class="bar" role="img" aria-label="Power split bar">${blocks.slice(0, 40).map((c, i) => `<span class="blk" style="--c:${c};animation-delay:${i * 22}ms"></span>`).join("")}</div>
  <div class="wrap"><table><thead><tr><th>Coin</th><th>Power to allot</th><th>Share</th><th>USD / day</th></tr></thead><tbody>
  ${rows.map(r => `<tr><td><span class="chip" style="--c:${r.k.c}"></span>${r.id}</td><td>${fmt(r.power)}</td><td>${(r.power / total * 100).toFixed(1)}%</td><td>${usd(r.usd)}</td></tr>`).join("")}
  </tbody></table></div><p class="hint">Estimate from the numbers you entered.</p>`;
  $("out").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}
