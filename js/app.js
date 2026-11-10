(() => {
'use strict';

const WA = '77779805639';
const KEY = 'bb_cart_v2';
const INFO = 'bb_info_v1';
const LAST_ORDER_KEY = 'bb_last_order_v1';
const FREE = 8000;
const FEE = 500;

const CATS = [
  ['all', 'Все товары'],
  ['pants', 'Трусики'],
  ['diapers', 'Подгузники'],
  ['wipes', 'Влажные салфетки'],
  ['care', 'Дом и уход']
];

const TABLE = [
  ['NB', 2, 5],
  ['S', 4, 8],
  ['M', 6, 11],
  ['L', 9, 14],
  ['XL', 12, 18],
  ['XXL', 15, 22],
  ['XXXL', 20, 30]
];

const COMBOS = [
  {
    id: 'calm',
    title: 'Спокойный месяц',
    desc: 'Трусики Baybee и большая пачка салфеток LUNA Baby (120 шт).',
    sized: 'baybee_pants',
    items: ['baybee_pants', 'luna_baby_wipes_120']
  },
  {
    id: 'baby',
    title: 'Малыш 0+ и Эко-Дом',
    desc: 'Подгузники для новорождённых, эко-гель для белья и мини-салфетки.',
    sized: 'mama_znaet_diapers',
    items: ['mama_znaet_diapers', 'mama_znaet_eco_baby_gel', 'mama_znaet_wipes_15']
  },
  {
    id: 'home',
    title: 'Чистый дом',
    desc: 'Гель для стирки, эко-гель для детских комнат и антижир для кухни.',
    sized: null,
    items: ['mama_znaet_laundry_gel', 'mama_znaet_cleaning_gel', 'mama_znaet_antifat']
  }
];

const $ = (s, r = document) => r.querySelector(s);
const fmt = n => n.toLocaleString('ru-RU') + ' ₸';
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[–—]/g, '-');
const clean = s => String(s || '').replace(/\p{Extended_Pictographic}|\p{Regional_Indicator}|\uFE0F|\u200D/gu, '').trim();
const range = s => s.weight.replace(' кг', '').split('–').map(Number);
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 900);

const rawCart = load(KEY, []);
const st = {
  products: [],
  map: {},
  cat: 'all',
  brand: 'all',
  q: '',
  sort: 'pop',
  w: null,
  sel: {},
  csel: {},
  wa: '',
  cart: Array.isArray(rawCart) ? rawCart.filter(x => x && typeof x.id === 'string' && Number.isInteger(x.si) && Number.isInteger(x.qty) && x.qty > 0) : []
};

const grid = $('#grid');

// Расчет соответствия веса размеру
function pick(p, w) {
  if (w == null || !p || !p.sizes) return 0;
  let best = -1, bm = -1;
  p.sizes.forEach((s, i) => {
    const [a, z] = range(s);
    if (w >= a && w <= z && a > bm) {
      bm = a;
      best = i;
    }
  });
  return best < 0 ? 0 : best;
}

const idx = p => (st.sel[p.id] != null ? st.sel[p.id] : pick(p, st.w));
const qty = (id, si) => { const l = st.cart.find(x => x.id === id && x.si === si); return l ? l.qty : 0; };
const spec = (p, i) => p.sizes ? p.sizes[i].size + ' · ' + p.sizes[i].weight + ' · ' + p.sizes[i].count + ' шт' : (p.volume || p.count || '');

// Юнит-экономика и расчет запаса
function getProductUnitMetrics(p, sizeIndex = 0) {
  if (p.sizes && p.sizes[sizeIndex]) {
    const s = p.sizes[sizeIndex];
    const count = s.count || 0;
    if (!count) return null;
    const unitPrice = Math.round(p.price / count);
    const code = (s.code || s.size || '').toUpperCase();
    let daily = 4;
    if (code.includes('NB') || code.includes('1')) daily = 7;
    else if (code.includes('S') || code.includes('2')) daily = 6;
    else if (code.includes('M') || code.includes('3')) daily = 5;
    else if (code.includes('L') || code.includes('4')) daily = 4;
    else if (code.includes('XL') || code.includes('5')) daily = 3.5;
    else if (code.includes('XXL') || code.includes('XXXL') || code.includes('6') || code.includes('7')) daily = 3;
    const days = Math.max(1, Math.round(count / daily));
    return {
      unitPriceStr: `~${unitPrice} ₸ / шт`,
      supplyStr: `Хватит на ~${days} дн.`
    };
  }
  if (p.category === 'wipes' && p.count) {
    const num = parseInt(p.count, 10);
    if (num > 0) {
      const perWipe = (p.price / num).toFixed(1).replace('.0', '');
      return {
        unitPriceStr: `~${perWipe} ₸ / салфетка`,
        supplyStr: p.count
      };
    }
  }
  if (p.volume) {
    const matchL = p.volume.match(/([\d.,]+)\s*литр/i);
    if (matchL) {
      const l = parseFloat(matchL[1].replace(',', '.'));
      const perL = Math.round(p.price / l);
      return {
        unitPriceStr: `~${perL.toLocaleString('ru-RU')} ₸ / л`,
        supplyStr: `Объем ${p.volume}`
      };
    }
  }
  return null;
}

// Карточка товара с юнит-метриками
function cardHTML(p) {
  const i = idx(p), q = qty(p.id, i), tag = clean(p.badge);
  const metrics = getProductUnitMetrics(p, i);

  const metricBadge = metrics ? `
    <div class='card__unit-bar'>
      <span class='unit-price'>${metrics.unitPriceStr}</span>
      <span class='unit-supply'>${metrics.supplyStr}</span>
    </div>` : '';

  const sizes = p.sizes
    ? `<div class='sz' role='group' aria-label='Размер'>${p.sizes.map((s, k) =>
        `<button type='button' class='sz__b${k === i ? ' on' : ''}' data-act='size' data-id='${esc(p.id)}' data-i='${k}' aria-pressed='${k === i}'>${esc(s.size.split(' ')[0])}</button>`
      ).join('')}</div>
      <p class='meta'>${esc(spec(p, i))}</p>`
    : `<p class='meta'>${esc(p.volume || p.count || '')}</p>`;

  const action = q
    ? `<div class='step'>
        <button type='button' data-act='dec' data-id='${esc(p.id)}' data-i='${i}' aria-label='Убавить'>−</button>
        <span>${q}</span>
        <button type='button' data-act='inc' data-id='${esc(p.id)}' data-i='${i}' aria-label='Добавить ещё'>+</button>
       </div>`
    : `<button type='button' class='btn btn--p add' data-act='add' data-id='${esc(p.id)}' data-i='${i}'>В корзину</button>`;

  return `
    <article class='card' data-card='${esc(p.id)}'>
      <div class='card__img'>
        ${tag ? `<span class='card__tag'>${esc(tag)}</span>` : ''}
        <img src='${esc(p.image)}' alt='${esc(p.name)}' width='400' height='400' loading='lazy' decoding='async'>
      </div>
      <div class='card__b'>
        <span class='card__br'>${esc(p.brand)}</span>
        <h3 class='card__n'>${esc(p.name)}</h3>
        ${metricBadge}
        ${sizes}
        <div class='card__f'>
          <span class='price'>${fmt(p.price)}</span>
          ${action}
        </div>
      </div>
    </article>`;
}

function filtered() {
  const q = st.q;
  let l = st.products.filter(p =>
    (st.cat === 'all' || p.category === st.cat) &&
    (st.brand === 'all' || p.brand === st.brand) &&
    (!q || p._s.includes(q))
  );
  if (st.sort === 'asc') l = l.slice().sort((a, b) => a.price - b.price);
  if (st.sort === 'desc') l = l.slice().sort((a, b) => b.price - a.price);
  return l;
}

function render() {
  const l = filtered();
  $('#resCount').textContent = l.length ? 'Найдено: ' + l.length : '';
  grid.innerHTML = l.length
    ? l.map(cardHTML).join('')
    : `<div class='empty'>
        <h3>Ничего не нашли</h3>
        <p>Попробуйте другой запрос или сбросьте фильтры.</p>
        <button class='btn btn--g' type='button' data-act='reset'>Сбросить фильтры</button>
       </div>`;
  renderChips();
}

function renderChips() {
  $('#chips').innerHTML = CATS.map(([k, n]) => {
    const c = k === 'all' ? st.products.length : st.products.filter(p => p.category === k).length;
    return `<button type='button' class='chip${st.cat === k ? ' on' : ''}' role='tab' aria-selected='${st.cat === k}' data-act='cat' data-k='${k}'>${n}<i>${c}</i></button>`;
  }).join('');
}

function renderCombos() {
  const html = COMBOS.map(c => {
    const ps = c.items.map(id => st.map[id]);
    if (ps.some(p => !p)) return '';
    const sum = ps.reduce((s, p) => s + p.price, 0);
    const sp = c.sized ? st.map[c.sized] : null;
    const cur = sp ? (st.csel[c.id] != null ? st.csel[c.id] : pick(sp, st.w)) : 0;
    const sel = sp ? `<label class='fld'>Размер<select data-csel='${c.id}'>${sp.sizes.map((s, k) => `<option value='${k}'${k === cur ? ' selected' : ''}>${esc(s.size)} · ${esc(s.weight)}</option>`).join('')}</select></label>` : '';
    return `
      <article class='combo'>
        <h3>${esc(c.title)}</h3>
        <p class='mut'>${esc(c.desc)}</p>
        <ul class='cl'>${ps.map(p => `<li>${esc(p.name)}</li>`).join('')}</ul>
        ${sel}
        <div class='combo__f'>
          <span class='price'>${fmt(sum)}</span>
          <button type='button' class='btn btn--p' data-act='combo' data-id='${c.id}'>Добавить набор</button>
        </div>
      </article>`;
  }).join('');
  $('#combos').hidden = !html;
  $('#cgrid').innerHTML = html;
}

function addCombo(cid) {
  const c = COMBOS.find(x => x.id === cid);
  if (!c) return;
  const sp = c.sized ? st.map[c.sized] : null;
  const cur = sp ? (st.csel[c.id] != null ? st.csel[c.id] : pick(sp, st.w)) : 0;
  c.items.forEach(id => {
    if (st.map[id]) change(id, id === c.sized ? cur : 0, 1, true);
  });
  toast('Набор «' + c.title + '» добавлен в корзину');
}

function refreshCard(id) {
  const el = grid.querySelector(`[data-card='${CSS.escape(id)}']`);
  const p = st.map[id];
  if (el && p) el.outerHTML = cardHTML(p);
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('on'), 2000);
}

// Микро-анимация капли меда и тактильный отклик
function triggerFlyHoney(originEl) {
  if (!originEl) return;
  if ('vibrate' in navigator) {
    try { navigator.vibrate(15); } catch (e) {}
  }
  const rect = originEl.getBoundingClientRect();
  const target = (window.innerWidth < 900 ? $('#dockCart') : $('#cartBtn')) || originEl;
  const tRect = target.getBoundingClientRect();

  const drop = document.createElement('div');
  drop.className = 'honey-drop';
  drop.textContent = '🍯';
  drop.style.left = `${rect.left + rect.width / 2}px`;
  drop.style.top = `${rect.top}px`;

  const tx = (tRect.left + tRect.width / 2) - (rect.left + rect.width / 2);
  const ty = (tRect.top + tRect.height / 2) - rect.top;
  drop.style.setProperty('--tx', `${tx}px`);
  drop.style.setProperty('--ty', `${ty}px`);

  document.body.appendChild(drop);
  setTimeout(() => drop.remove(), 750);
}

function change(id, si, d, quiet, targetEl) {
  const p = st.map[id];
  if (!p) return;
  let l = st.cart.find(x => x.id === id && x.si === si);
  if (!l && d > 0) {
    l = { id, si, qty: 0 };
    st.cart.push(l);
  }
  if (!l) return;
  l.qty += d;
  if (l.qty <= 0) st.cart = st.cart.filter(x => x !== l);
  store(KEY, st.cart);
  refreshCard(id);
  cartUI();
  if (d > 0 && targetEl) triggerFlyHoney(targetEl);
  if (!quiet && d > 0 && l.qty === 1) toast('Добавлено в корзину');
}

function lines() {
  return st.cart.map(l => {
    const p = st.map[l.id];
    return p && (!p.sizes || p.sizes[l.si]) ? { l, p, sum: p.price * l.qty } : null;
  }).filter(Boolean);
}

const total = () => lines().reduce((s, x) => s + x.sum, 0);
const count = () => lines().reduce((s, x) => s + x.l.qty, 0);
const plural = n => n % 10 === 1 && n % 100 !== 11 ? 'товар' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'товара' : 'товаров');

function mode() {
  const r = document.querySelector('input[name=mode]:checked');
  return r ? r.value : 'Доставка курьером';
}

function shipUI() {
  const n = count(), t = total(), pickup = mode() === 'Самовывоз';
  const fill = $('#shipFill');
  const shipText = $('#ship');

  if (!n) {
    if (fill) fill.style.width = '0%';
    if (shipText) shipText.textContent = '';
    return;
  }

  if (pickup) {
    if (fill) fill.style.width = '100%';
    if (shipText) shipText.textContent = 'Самовывоз: бесплатно';
  } else if (t >= FREE) {
    if (fill) fill.style.width = '100%';
    if (shipText) shipText.textContent = '🎉 Бесплатная доставка включена!';
  } else {
    const diff = FREE - t;
    const pct = Math.min(100, Math.round((t / FREE) * 100));
    if (fill) fill.style.width = pct + '%';
    if (shipText) shipText.textContent = 'До бесплатной доставки осталось ' + fmt(diff) + ' (иначе ' + fmt(FEE) + ' по городу)';
  }

  // Cross-sell в корзине
  const upsell = $('#cartUpsell');
  if (upsell) {
    if (!pickup && t < FREE && n > 0) {
      const suggest = st.map['luna_baby_wipes_120'] || st.map['softcare_wipes'] || st.map['mama_znaet_wipes_15'];
      if (suggest && !st.cart.some(x => x.id === suggest.id)) {
        upsell.hidden = false;
        $('#cartUpsellItem').innerHTML = `
          <div>
            <div class='cart-upsell__name'>${esc(suggest.name.split('—')[1] || suggest.name)}</div>
            <div class='cart-upsell__price'>+${fmt(suggest.price)}</div>
          </div>
          <button type='button' class='btn btn--p btn--sm' data-act='add' data-id='${esc(suggest.id)}' data-i='0'>+ Добавить</button>
        `;
      } else {
        upsell.hidden = true;
      }
    } else {
      upsell.hidden = true;
    }
  }
}

function cartUI() {
  const ls = lines(), n = count(), t = total();

  // Верхний значок
  const topBadge = $('#cartN');
  if (topBadge) {
    topBadge.hidden = !n;
    topBadge.textContent = n;
  }

  // Мобильный док
  const dockBadge = $('#dockBadge');
  const dockTotal = $('#dockTotal');
  const dockCartItem = $('.dock-item--cart');
  if (dockBadge && dockTotal && dockCartItem) {
    dockBadge.hidden = !n;
    dockBadge.textContent = n;
    dockTotal.hidden = !n;
    dockTotal.textContent = fmt(t);
    dockCartItem.classList.toggle('has-items', n > 0);
  }

  // Плавающий десктопный бар
  $('#barTotal').textContent = fmt(t);
  $('#barCount').textContent = n + ' ' + plural(n);
  $('#bar').classList.toggle('on', n > 0);

  $('#total').textContent = fmt(t);
  $('#send').disabled = !n;
  $('#form').hidden = !n;
  shipUI();

  $('#items').innerHTML = n
    ? ls.map(({ l, p, sum }) => `
        <div class='ci'>
          <img src='${esc(p.image)}' alt='' loading='lazy'>
          <div>
            <div class='ci__n'>${esc(p.name)}</div>
            <div class='ci__s'>${esc(spec(p, l.si))}</div>
          </div>
          <div class='ci__r'>
            <div class='step'>
              <button type='button' data-act='dec' data-id='${esc(p.id)}' data-i='${l.si}' aria-label='Убавить'>−</button>
              <span>${l.qty}</span>
              <button type='button' data-act='inc' data-id='${esc(p.id)}' data-i='${l.si}' aria-label='Добавить ещё'>+</button>
            </div>
            <b>${fmt(sum)}</b>
          </div>
        </div>
      `).join('')
    : `<div class='cempty'><h3>Корзина пуста</h3><p>Добавьте подгузники или товары для дома из каталога.</p></div>`;
}

const drawer = $('#drawer'), scrim = $('#scrim');

function openCart() {
  $('#toast').classList.remove('on');
  drawer.classList.remove('is-done');
  $('#done').hidden = true;
  scrim.hidden = false;
  requestAnimationFrame(() => scrim.classList.add('on'));
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('lock');
  setTimeout(() => $('#drClose').focus(), 50);
}

function closeCart() {
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  scrim.classList.remove('on');
  setTimeout(() => { scrim.hidden = true; }, 250);
  document.documentElement.classList.remove('lock');
}

function syncMode() {
  const pickup = mode() === 'Самовывоз';
  $('#addrWrap').hidden = pickup;
  $('#silentWrap').hidden = pickup;
  $('#pickNote').hidden = !pickup;
  shipUI();
}

// Сохранение заказа для 1-Tap Reorder
function saveLastOrder(code, items, goods, fee, total, name, addr, pay, modeVal) {
  const payload = {
    code,
    timestamp: Date.now(),
    dateStr: new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date()),
    items: items.map(({ l, p }) => ({
      id: l.id,
      si: l.si,
      qty: l.qty,
      name: p.name,
      spec: p.sizes ? p.sizes[l.si].size : (p.volume || p.count || '')
    })),
    total,
    name,
    addr,
    pay,
    mode: modeVal
  };
  store(LAST_ORDER_KEY, payload);
}

// Проверка и показ 1-Tap Reorder
function checkReorder() {
  const last = load(LAST_ORDER_KEY, null);
  const banner = $('#reorderBanner');
  if (!banner) return;
  if (!last || !Array.isArray(last.items) || !last.items.length) {
    banner.hidden = true;
    return;
  }
  const validItems = last.items.filter(it => st.map[it.id]);
  if (!validItems.length) {
    banner.hidden = true;
    return;
  }

  $('#reorderDate').textContent = last.dateStr;
  $('#reorderSummary').textContent = validItems.map(it => it.name.split('—')[0].trim() + (it.spec ? ' ' + it.spec.split(' ')[0] : '') + ' × ' + it.qty).join(', ');
  $('#reorderAddr').textContent = last.mode === 'Самовывоз' ? '📦 Самовывоз' : ('📍 ' + (last.addr || 'по городу'));
  $('#reorderSum').textContent = fmt(last.total);
  banner.hidden = false;

  $('#btnReorderOneTap').onclick = () => {
    st.cart = validItems.map(it => ({ id: it.id, si: it.si, qty: it.qty }));
    store(KEY, st.cart);
    cartUI();
    render();
    toast('Прошлый заказ загружен в корзину');
    openCart();
  };

  $('#btnDismissReorder').onclick = () => {
    banner.hidden = true;
  };
}

function send() {
  const pickup = mode() === 'Самовывоз';
  const name = $('#fName').value.trim(), addr = $('#fAddr').value.trim(), note = $('#fNote').value.trim();
  if (!pickup && !addr) {
    const a = $('#fAddr');
    a.classList.add('bad');
    $('#addrErr').hidden = false;
    a.scrollIntoView({ behavior: 'smooth', block: 'center' });
    a.focus({ preventScroll: true });
    return;
  }
  $('#addrErr').hidden = true;
  $('#fAddr').classList.remove('bad');
  store(INFO, { name, addr, pay: $('#fPay').value });

  const code = 'BB-' + Date.now().toString(36).slice(-5).toUpperCase();
  const ls = lines(), goods = total();
  const fee = pickup || goods >= FREE ? 0 : FEE;
  const silent = !pickup && $('#fSilent').checked;

  const msg = [
    ...(silent ? ['🤫 Тихая доставка (малыш спит): не звоните в дверь, напишите в WhatsApp у двери', ''] : []),
    'Здравствуйте! Хочу сделать заказ в Baby Bee.',
    'Заказ: #' + code, '',
    'Состав заказа:',
    ...ls.map(({ l, p, sum }, i) => (i + 1) + '. ' + p.name + '\n   ' + spec(p, l.si) + ' × ' + l.qty + ' = ' + fmt(sum)),
    '',
    'Товары: ' + fmt(goods),
    pickup ? 'Получение: Самовывоз (пункт выдачи: г. Шемонаиха)' : 'Получение: Доставка курьером',
    pickup ? '' : 'Доставка: ' + (fee ? fmt(fee) : 'бесплатно'),
    'К оплате: ' + fmt(goods + fee),
    pickup ? '' : 'Адрес: ' + addr,
    'Оплата: ' + $('#fPay').value,
    'Имя: ' + (name || 'не указано'),
    note ? 'Комментарий: ' + note : ''
  ].filter((x, i, a) => x !== '' || (a[i - 1] !== '' && i < a.length - 1)).join('\n');

  // Сохраняем для повторного заказа
  saveLastOrder(code, ls, goods, fee, goods + fee, name, addr, $('#fPay').value, mode());

  st.wa = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(msg);
  $('#doneT').textContent = 'Заказ #' + code + ' сформирован';
  $('#doneWa').href = st.wa;

  st.cart = [];
  store(KEY, st.cart);
  cartUI();
  render();

  drawer.classList.add('is-done');
  $('#done').hidden = false;

  if (MOBILE) window.location.href = st.wa;
  else window.open(st.wa, '_blank', 'noopener');
}

// Детальный расчет веса
function wRes() {
  const w = +$('#wRange').value;
  $('#wOut').textContent = w + ' кг';
  const r = TABLE.filter(([, a, z]) => w >= a && w <= z);
  $('#wRes').innerHTML = r.length
    ? r.map(([n, a, z]) => `<button type='button' class='wchip' data-act='wsize' data-w='${Math.round((a + z) / 2)}' aria-label='Размер ${n}, ${a}–${z} кг'>${n}</button>`).join('') + '<em>ориентировочно, зависит от бренда</em>'
    : '<em>Для такого веса уточните размер в WhatsApp</em>';
}

function setRange(v) {
  v = Math.max(2, Math.min(30, v));
  $('#wRange').value = v;
  wRes();
}

function setWeight(w) {
  st.w = w;
  st.sel = {};
  st.csel = {};
  const tag = $('#wTag');
  tag.hidden = w == null;
  if (w != null) tag.innerHTML = `<span>Размеры подобраны для ${w} кг</span><button type='button' data-act='wreset'>Сбросить</button>`;
  render();
  renderCombos();
}

function resetFilters() {
  st.cat = 'all';
  st.brand = 'all';
  st.q = '';
  st.w = null;
  $('#q').value = '';
  $('#brand').value = 'all';
  $('#wTag').hidden = true;
  document.querySelectorAll('.qw-btn').forEach(b => b.classList.toggle('on', b.dataset.w === 'all'));
  render();
}

// Слушатели событий
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const a = b.dataset.act, id = b.dataset.id, i = +b.dataset.i;

  if (a === 'add' || a === 'inc') change(id, i, 1, false, b);
  else if (a === 'dec') change(id, i, -1);
  else if (a === 'size') {
    st.sel[id] = i;
    refreshCard(id);
  }
  else if (a === 'cat') {
    st.cat = b.dataset.k;
    render();
    b.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
  else if (a === 'reset') resetFilters();
  else if (a === 'wreset') {
    setWeight(null);
    document.querySelectorAll('.qw-btn').forEach(btn => btn.classList.toggle('on', btn.dataset.w === 'all'));
  }
  else if (a === 'wm') setRange(+$('#wRange').value - 1);
  else if (a === 'wp') setRange(+$('#wRange').value + 1);
  else if (a === 'wsize') setRange(+b.dataset.w);
  else if (a === 'combo') addCombo(id);
  else if (a === 'quick-w') {
    document.querySelectorAll('.qw-btn').forEach(btn => btn.classList.remove('on'));
    b.classList.add('on');
    const val = b.dataset.w;
    if (val === 'all') {
      setWeight(null);
    } else {
      setWeight(+val);
      $('#catalog').scrollIntoView({ behavior: 'smooth' });
    }
  }
});

document.addEventListener('change', e => {
  const s = e.target.closest('[data-csel]');
  if (s) st.csel[s.dataset.csel] = +s.value;
});

// Кнопки корзины
$('#cartBtn').addEventListener('click', openCart);
$('#barBtn').addEventListener('click', openCart);
$('#drClose').addEventListener('click', closeCart);
scrim.addEventListener('click', closeCart);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && drawer.classList.contains('open')) closeCart();
});

$('#form').addEventListener('submit', e => { e.preventDefault(); send(); });
$('#fAddr').addEventListener('input', () => {
  $('#fAddr').classList.remove('bad');
  $('#addrErr').hidden = true;
});
$('#send').addEventListener('click', send);
$('#newOrder').addEventListener('click', closeCart);
document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', syncMode));

$('#wRange').addEventListener('input', wRes);
$('#wApply').addEventListener('click', () => {
  setWeight(+$('#wRange').value);
  $('#catalog').scrollIntoView({ behavior: 'smooth' });
});

// Быстрый поиск с автоочисткой
let searchTimer;
const qInput = $('#q');
const qClear = $('#qClear');

qInput.addEventListener('input', e => {
  const val = e.target.value;
  if (qClear) qClear.hidden = !val;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    st.q = norm(val.trim());
    render();
  }, 160);
});

if (qClear) {
  qClear.addEventListener('click', () => {
    qInput.value = '';
    qClear.hidden = true;
    st.q = '';
    render();
    qInput.focus();
  });
}

$('#brand').addEventListener('change', e => {
  st.brand = e.target.value;
  render();
});
$('#sort').addEventListener('change', e => {
  st.sort = e.target.value;
  render();
});

// Навигация нижнего дока
const dockItems = document.querySelectorAll('.dock-item');
function setDockActive(key) {
  dockItems.forEach(it => it.classList.toggle('active', it.dataset.dock === key));
}

$('#dockCatalog').addEventListener('click', () => {
  setDockActive('catalog');
  $('#catalog').scrollIntoView({ behavior: 'smooth' });
});
$('#dockCombos').addEventListener('click', () => {
  setDockActive('combos');
  $('#combos').scrollIntoView({ behavior: 'smooth' });
});
$('#dockSizes').addEventListener('click', () => {
  setDockActive('sizes');
  $('#sizes').scrollIntoView({ behavior: 'smooth' });
});
$('#dockCart').addEventListener('click', () => {
  openCart();
});

// Прилипающий Header (Sticky Shadow)
const stickySuper = $('#stickySuper');
if (stickySuper) {
  window.addEventListener('scroll', () => {
    const isPinned = stickySuper.getBoundingClientRect().top <= 60;
    stickySuper.classList.toggle('is-pinned', isPinned);
  }, { passive: true });
}

// Секретный код разработчика 7788
let devBuf = '';
window.addEventListener('keydown', e => {
  if (e.key >= '0' && e.key <= '9') {
    devBuf = (devBuf + e.key).slice(-4);
    if (devBuf === '7788') {
      const p1 = st.products.find(p => p.sizes);
      const p2 = st.products.find(p => p.category === 'wipes');
      if (p1 && p2) {
        st.cart = [
          { id: p1.id, si: 1, qty: 1 },
          { id: p2.id, si: 0, qty: 2 }
        ];
        store(KEY, st.cart);
        cartUI();
        render();
        toast('⚡ Тестовый режим 7788: корзина заполнена!');
      }
    }
  }
});

// Загрузка данных пользователя
const info = load(INFO, {});
if (info.name) $('#fName').value = info.name;
if (info.addr) $('#fAddr').value = info.addr;
if (info.pay) $('#fPay').value = info.pay;

wRes();
syncMode();
cartUI();
grid.innerHTML = Array.from({ length: 8 }, () => "<div class='sk'></div>").join('');

function init() {
  fetch('data/products.json')
    .then(r => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(data => {
      st.products = data;
      data.forEach(p => {
        st.map[p.id] = p;
        const sz = (p.sizes || []).map(s => s.size + ' ' + s.code + ' ' + s.weight).join(' ');
        p._s = norm([p.name, p.brand, p.description, p.volume, p.count, sz].join(' '));
      });
      st.cart = st.cart.filter(l => st.map[l.id] && (!st.map[l.id].sizes || st.map[l.id].sizes[l.si]));
      const brands = [...new Set(data.map(p => p.brand))].sort((a, b) => a.localeCompare(b, 'ru'));
      $('#brand').innerHTML = "<option value='all'>Все бренды</option>" + brands.map(b => `<option value='${esc(b)}'>${esc(b)}</option>`).join('');
      $('#heroCount').textContent = data.length + '+';
      render();
      renderCombos();
      cartUI();
      checkReorder();
    })
    .catch(() => {
      grid.innerHTML = `
        <div class='empty'>
          <h3>Не удалось загрузить каталог</h3>
          <p>Проверьте интернет и попробуйте снова.</p>
          <button class='btn btn--p' type='button' id='retry'>Повторить</button>
        </div>`;
      $('#retry').addEventListener('click', init);
    });
}

init();
})();
