(() => {
'use strict';
const WA = '77779805639', KEY = 'bb_cart_v2', INFO = 'bb_info_v1';
const CATS = [['all', 'Все товары'], ['pants', 'Трусики'], ['diapers', 'Подгузники'], ['wipes', 'Влажные салфетки'], ['care', 'Дом и уход']];
const TABLE = [['NB', 2, 5], ['S', 4, 8], ['M', 6, 11], ['L', 9, 14], ['XL', 12, 18], ['XXL', 15, 22], ['XXXL', 20, 30]];
const $ = (s, r = document) => r.querySelector(s);
const fmt = n => n.toLocaleString('ru-RU') + ' ₸';
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
const clean = s => String(s || '').replace(/\p{Extended_Pictographic}|\p{Regional_Indicator}|\uFE0F|\u200D/gu, '').trim();
const range = s => s.weight.replace(' кг', '').split('–').map(Number);
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

const st = { products: [], map: {}, cat: 'all', brand: 'all', q: '', sort: 'pop', w: null, sel: {}, cart: load(KEY, []), wa: '' };
if (!Array.isArray(st.cart)) st.cart = [];

const grid = $('#grid');

function pick(p, w) {
  if (w == null || !p.sizes) return 0;
  let best = -1, bm = -1;
  p.sizes.forEach((s, i) => { const [a, z] = range(s); if (w >= a && w <= z && a > bm) { bm = a; best = i; } });
  return best < 0 ? 0 : best;
}
const idx = p => (st.sel[p.id] != null ? st.sel[p.id] : pick(p, st.w));
const qty = (id, si) => { const l = st.cart.find(x => x.id === id && x.si === si); return l ? l.qty : 0; };
const spec = (p, i) => p.sizes ? p.sizes[i].size + ' · ' + p.sizes[i].weight + ' · ' + p.sizes[i].count + ' шт' : (p.volume || p.count || '');

function cardHTML(p) {
  const i = idx(p), q = qty(p.id, i), tag = clean(p.badge);
  const sizes = p.sizes
    ? `<div class='sz' role='group' aria-label='Размер'>${p.sizes.map((s, k) => `<button type='button' class='sz__b${k === i ? ' on' : ''}' data-act='size' data-id='${esc(p.id)}' data-i='${k}' aria-pressed='${k === i}'>${esc(s.size.split(' ')[0])}</button>`).join('')}</div><p class='meta'>${esc(spec(p, i))}</p>`
    : `<p class='meta'>${esc(p.volume || p.count || '')}</p>`;
  const action = q
    ? `<div class='step'><button type='button' data-act='dec' data-id='${esc(p.id)}' data-i='${i}' aria-label='Убавить'>−</button><span>${q}</span><button type='button' data-act='inc' data-id='${esc(p.id)}' data-i='${i}' aria-label='Добавить ещё'>+</button></div>`
    : `<button type='button' class='btn btn--p add' data-act='add' data-id='${esc(p.id)}' data-i='${i}'>В корзину</button>`;
  return `<article class='card' data-card='${esc(p.id)}'><div class='card__img'>${tag ? `<span class='card__tag'>${esc(tag)}</span>` : ''}<img src='${esc(p.image)}' alt='${esc(p.name)}' width='400' height='400' loading='lazy' decoding='async'></div><div class='card__b'><span class='card__br'>${esc(p.brand)}</span><h3 class='card__n'>${esc(p.name)}</h3><p class='card__d'>${esc(p.description || '')}</p>${sizes}<div class='card__f'><span class='price'>${fmt(p.price)}</span>${action}</div></div></article>`;
}

function filtered() {
  const q = st.q;
  let l = st.products.filter(p =>
    (st.cat === 'all' || p.category === st.cat) &&
    (st.brand === 'all' || p.brand === st.brand) &&
    (!q || (p.name + ' ' + p.brand + ' ' + (p.description || '')).toLowerCase().includes(q)));
  if (st.sort === 'asc') l = l.slice().sort((a, b) => a.price - b.price);
  if (st.sort === 'desc') l = l.slice().sort((a, b) => b.price - a.price);
  return l;
}

function render() {
  const l = filtered();
  $('#resCount').textContent = l.length ? 'Найдено: ' + l.length : '';
  grid.innerHTML = l.length ? l.map(cardHTML).join('') : `<div class='empty'><h3>Ничего не нашли</h3><p>Попробуйте другой запрос или категорию.</p><button class='btn btn--g' type='button' data-act='reset'>Сбросить фильтры</button></div>`;
  renderChips();
}

function renderChips() {
  $('#chips').innerHTML = CATS.map(([k, n]) => {
    const c = k === 'all' ? st.products.length : st.products.filter(p => p.category === k).length;
    return `<button type='button' class='chip${st.cat === k ? ' on' : ''}' role='tab' aria-selected='${st.cat === k}' data-act='cat' data-k='${k}'>${n}<i>${c}</i></button>`;
  }).join('');
}

function refreshCard(id) {
  const el = grid.querySelector(`[data-card='${CSS.escape(id)}']`);
  const p = st.map[id];
  if (el && p) el.outerHTML = cardHTML(p);
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 1800);
}

function change(id, si, d) {
  const p = st.map[id]; if (!p) return;
  let l = st.cart.find(x => x.id === id && x.si === si);
  if (!l && d > 0) { l = { id, si, qty: 0 }; st.cart.push(l); }
  if (!l) return;
  l.qty += d;
  if (l.qty <= 0) st.cart = st.cart.filter(x => x !== l);
  store(KEY, st.cart);
  refreshCard(id);
  cartUI();
  if (d > 0 && l.qty === 1) toast('Добавлено в корзину');
}

function lines() {
  return st.cart.map(l => { const p = st.map[l.id]; return p ? { l, p, sum: p.price * l.qty } : null; }).filter(Boolean);
}
const total = () => lines().reduce((s, x) => s + x.sum, 0);
const count = () => lines().reduce((s, x) => s + x.l.qty, 0);
const plural = n => n % 10 === 1 && n % 100 !== 11 ? 'товар' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'товара' : 'товаров');

function cartUI() {
  const ls = lines(), n = count(), t = total();
  const badge = $('#cartN');
  badge.hidden = !n; badge.textContent = n;
  $('#barTotal').textContent = fmt(t);
  $('#barCount').textContent = n + ' ' + plural(n);
  $('#bar').classList.toggle('on', n > 0);
  document.body.classList.toggle('has-bar', n > 0);
  $('#total').textContent = fmt(t);
  $('#send').disabled = !n;
  $('#form').hidden = !n;
  $('#items').innerHTML = n ? ls.map(({ l, p, sum }) => `<div class='ci'><img src='${esc(p.image)}' alt='' loading='lazy'><div><div class='ci__n'>${esc(p.name)}</div><div class='ci__s'>${esc(spec(p, l.si))}</div></div><div class='ci__r'><div class='step'><button type='button' data-act='dec' data-id='${esc(p.id)}' data-i='${l.si}' aria-label='Убавить'>−</button><span>${l.qty}</span><button type='button' data-act='inc' data-id='${esc(p.id)}' data-i='${l.si}' aria-label='Добавить ещё'>+</button></div><b>${fmt(sum)}</b></div></div>`).join('') : `<div class='cempty'><h3>Корзина пуста</h3><p>Добавьте подгузники или товары для дома из каталога.</p></div>`;
}

const drawer = $('#drawer'), scrim = $('#scrim');
function openCart() {
  drawer.classList.remove('is-done'); $('#done').hidden = true;
  scrim.hidden = false; requestAnimationFrame(() => scrim.classList.add('on'));
  drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('lock');
  setTimeout(() => $('#drClose').focus(), 50);
}
function closeCart() {
  drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true');
  scrim.classList.remove('on'); setTimeout(() => { scrim.hidden = true; }, 250);
  document.documentElement.classList.remove('lock');
}

function mode() { const r = document.querySelector('input[name=mode]:checked'); return r ? r.value : 'Доставка курьером'; }
function syncMode() {
  const pick = mode() === 'Самовывоз';
  $('#addrWrap').hidden = pick;
}

function send() {
  const pickup = mode() === 'Самовывоз';
  const name = $('#fName').value.trim(), addr = $('#fAddr').value.trim(), note = $('#fNote').value.trim();
  if (!pickup && !addr) { $('#addrErr').hidden = false; $('#fAddr').focus(); return; }
  $('#addrErr').hidden = true;
  store(INFO, { name, addr, pay: $('#fPay').value });
  const code = 'BB-' + Date.now().toString(36).slice(-5).toUpperCase();
  const ls = lines();
  const msg = [
    'Здравствуйте! Хочу сделать заказ в Baby Bee.',
    'Заказ: #' + code, '',
    'Состав заказа:',
    ...ls.map(({ l, p, sum }, i) => (i + 1) + '. ' + p.name + '\n   ' + spec(p, l.si) + ' × ' + l.qty + ' = ' + fmt(sum)),
    '',
    'Итого: ' + fmt(total()),
    'Получение: ' + mode(),
    pickup ? '' : 'Адрес: ' + addr,
    'Оплата: ' + $('#fPay').value,
    'Имя: ' + (name || 'не указано'),
    note ? 'Комментарий: ' + note : ''
  ].filter((x, i, a) => x !== '' || (a[i - 1] !== '' && i < a.length - 1)).join('\n');
  st.wa = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(msg);
  $('#doneT').textContent = 'Заказ #' + code + ' сформирован';
  $('#doneWa').href = st.wa;
  drawer.classList.add('is-done'); $('#done').hidden = false;
  window.open(st.wa, '_blank', 'noopener');
}

function wRes() {
  const w = +$('#wRange').value;
  $('#wOut').textContent = w + ' кг';
  const r = TABLE.filter(([, a, z]) => w >= a && w <= z).map(([n]) => n);
  $('#wRes').innerHTML = r.length ? r.map(n => `<span>${n}</span>`).join('') + '<em>ориентировочно, зависит от бренда</em>' : '<em>Для такого веса уточните размер в WhatsApp</em>';
}

function setWeight(w) {
  st.w = w; st.sel = {};
  const tag = $('#wTag');
  tag.hidden = w == null;
  if (w != null) tag.innerHTML = `<span>Размеры подобраны для ${w} кг</span><button type='button' data-act='wreset'>Сбросить</button>`;
  render();
}

function resetFilters() {
  st.cat = 'all'; st.brand = 'all'; st.q = '';
  $('#q').value = ''; $('#brand').value = 'all';
  render();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act, id = b.dataset.id, i = +b.dataset.i;
  if (a === 'add' || a === 'inc') change(id, i, 1);
  else if (a === 'dec') change(id, i, -1);
  else if (a === 'size') { st.sel[id] = i; refreshCard(id); }
  else if (a === 'cat') { st.cat = b.dataset.k; render(); }
  else if (a === 'reset') resetFilters();
  else if (a === 'wreset') setWeight(null);
});
$('#cartBtn').addEventListener('click', openCart);
$('#barBtn').addEventListener('click', openCart);
$('#drClose').addEventListener('click', closeCart);
scrim.addEventListener('click', closeCart);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('open')) closeCart(); });
$('#send').addEventListener('click', send);
$('#newOrder').addEventListener('click', () => { st.cart = []; store(KEY, st.cart); cartUI(); render(); closeCart(); });
document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', syncMode));
$('#wRange').addEventListener('input', wRes);
$('#wApply').addEventListener('click', () => { setWeight(+$('#wRange').value); $('#catalog').scrollIntoView({ behavior: 'smooth' }); });
let timer;
$('#q').addEventListener('input', e => { clearTimeout(timer); timer = setTimeout(() => { st.q = e.target.value.trim().toLowerCase(); render(); }, 180); });
$('#brand').addEventListener('change', e => { st.brand = e.target.value; render(); });
$('#sort').addEventListener('change', e => { st.sort = e.target.value; render(); });

const info = load(INFO, {});
if (info.name) $('#fName').value = info.name;
if (info.addr) $('#fAddr').value = info.addr;
if (info.pay) $('#fPay').value = info.pay;
wRes(); syncMode(); cartUI();
grid.innerHTML = Array.from({ length: 8 }, () => "<div class='sk'></div>").join('');

function init() {
  fetch('data/products.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(data => {
    st.products = data;
    data.forEach(p => { st.map[p.id] = p; });
    st.cart = st.cart.filter(l => st.map[l.id] && (!st.map[l.id].sizes || st.map[l.id].sizes[l.si]));
    const brands = [...new Set(data.map(p => p.brand))].sort((a, b) => a.localeCompare(b, 'ru'));
    $('#brand').innerHTML = "<option value='all'>Все бренды</option>" + brands.map(b => `<option value='${esc(b)}'>${esc(b)}</option>`).join('');
    $('#heroCount').textContent = data.length + '+';
    render(); cartUI();
  }).catch(() => {
    grid.innerHTML = `<div class='empty'><h3>Не удалось загрузить каталог</h3><p>Проверьте интернет и попробуйте снова.</p><button class='btn btn--p' type='button' id='retry'>Повторить</button></div>`;
    $('#retry').addEventListener('click', init);
  });
}
init();
})();
