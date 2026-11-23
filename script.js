// Set this to your deployed Cloudflare Worker URL (the private worker.js) before publishing.
const WORKER_URL = "";

const COINS = [
  {id:"BTC",name:"Bitcoin",c:"#f7931a"},{id:"ETH",name:"Ethereum",c:"#627eea"},
  {id:"DOGE",name:"Dogecoin",c:"#c2a633"},{id:"SOL",name:"Solana",c:"#14a085"},
  {id:"POL",name:"Polygon",c:"#8247e5"},{id:"LTC",name:"Litecoin",c:"#5c6f8f"},
  {id:"BNB",name:"BNB",c:"#d4a017"}
];
const U = {"Gh/s":1,"Th/s":1e3,"Ph/s":1e6,"Eh/s":1e9};
const $ = id => document.getElementById(id);
const f = $("f");
const unitSel = (id,sel) => `<select id="${id}" aria-label="Power unit">${Object.keys(U).map(u=>`<option${u===sel?" selected":""}>${u}</option>`).join("")}</select>`;

$("coins").innerHTML = COINS.map(k => `
<div class="coin" style="--c:${k.c}"><h3>${k.id} <span style="font:13px var(--ui)">${k.name}</span></h3>
<div class="grid">
<label>Price (USD)<input id="${k.id}-p" type="number" min="0" step="any" inputmode="decimal"></label>
<label>Block reward (coins)<input id="${k.id}-r" type="number" min="0" step="any" inputmode="decimal"></label>
<label>League power<span class="pw"><input id="${k.id}-l" type="number" min="0" step="any" inputmode="decimal">${unitSel(k.id+"-u","Ph/s")}</span></label>
<label>Block time (seconds)<input id="${k.id}-t" type="number" min="0" step="any" inputmode="decimal"></label>
<label class="mine">My power on this coin (same unit)<input id="${k.id}-m" type="number" min="0" step="any" inputmode="decimal"></label>
</div></div>`).join("");

f.addEventListener("change", () => f.classList.toggle("yes", f.has.value === "yes"));

const fmt = gh => { const u = Object.entries(U).reverse().find(([,v]) => gh >= v) || ["Gh/s",1]; return (gh/u[1]).toFixed(2).replace(/\.?0+$/,"") + " " + u[0]; };
const usd = n => "$" + n.toFixed(n < 1 ? 4 : 2);

f.addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("err"), btn = $("go"); err.textContent = "";
  if (!WORKER_URL) { err.textContent = "The calculator is not connected yet. Add your Worker URL in script.js."; return; }
  const total = +$("total").value * U[$("totalUnit").value];
  if (!(total > 0)) { err.textContent = "Enter your total power first."; return; }
  const yes = f.has.value === "yes", coins = [];
  for (const k of COINS) {
    const v = s => +$(k.id + "-" + s).value, u = U[$(k.id + "-u").value];
    const [p, r, l, t] = [v("p"), v("r"), v("l"), v("t")];
    if (![p, r, l, t].some(n => n > 0)) continue;
    if (![p, r, l, t].every(n => n > 0)) { err.textContent = `${k.id}: fill in all four numbers or clear the row.`; return; }
    const m = yes ? v("m") : 0;
    if (m < 0 || m >= l) { err.textContent = `${k.id}: your power must be lower than the league power.`; return; }
    coins.push({ id: k.id, price: p, reward: r, blockSec: t, others: (l - m) * u, mine: m * u });
  }
  if (!coins.length) { err.textContent = "Fill in at least one coin."; return; }
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
  </tbody></table></div><p class="hint">Estimate from the numbers you entered. Coins at 0% earn more for other uses of your power than they would for this one.</p>`;
  $("out").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}
