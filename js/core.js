/* core.js - หัวใจฝั่ง frontend: boot / auth / นำทาง / ข้อมูลตั้งต้น / helper */

/* ไอคอนของประเภทแผน (bootstrap-icons) */
const ICONS = {
  capsule: 'bi-capsule',
  bandaid: 'bi-bandaid-fill',
  heartpulse: 'bi-heart-pulse-fill',
  flask: 'bi-eyedropper',
  tooth: 'bi-emoji-smile-fill',
  radioactive: 'bi-radioactive',
  cup: 'bi-cup-hot-fill',
  shirt: 'bi-handbag-fill',
  house: 'bi-house-heart-fill',
  pencil: 'bi-pencil-fill',
  pc: 'bi-pc-display',
  tools: 'bi-tools',
  box: 'bi-box-seam-fill',
  prescription: 'bi-prescription2',
  printer: 'bi-printer-fill',
  people: 'bi-people-fill',
  cart: 'bi-cart-fill',
  truck: 'bi-truck',
  clipboard: 'bi-clipboard2-pulse-fill',
  bank: 'bi-bank',
  default: 'bi-box-seam-fill'
};
function iconClass(key) { return ICONS[key] || ICONS.default; }

/* ---------- ตัวเลข / เงิน ---------- */
function money(n, dec) {
  const d = dec === undefined ? 2 : dec;
  return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d });
}
/* ตัวเลขจำนวน: ตัด .00 ทิ้งถ้าเป็นจำนวนเต็ม */
function qty(n) {
  const v = Number(n || 0);
  return v % 1 === 0 ? v.toLocaleString('th-TH') : money(v);
}
/* ย่อจำนวนเงินสำหรับการ์ดสรุป (ย่อเฉพาะหลักล้านขึ้นไป) */
function moneyShort(n) {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1e6) return (v / 1e6).toLocaleString('th-TH', { maximumFractionDigits: 2 }) + ' ล้าน';
  return money(v, 0);
}
function numVal(el) {
  if (typeof el === 'string') el = document.getElementById(el);
  if (!el) return 0;
  const n = parseFloat(String(el.value || '').replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

/* ---------- วันที่ ---------- */
function todayLocal() {
  const d = new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function fmtDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  let y = d.getFullYear();
  if (typeof App !== 'undefined' && App.beYear) y += 543;
  return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + y;
}

/* วันที่แบบเต็ม เช่น 18 กันยายน 2569 */
const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                   'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
function fmtDateLong(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  let y = d.getFullYear();
  if (typeof App !== 'undefined' && App.beYear) y += 543;
  return d.getDate() + ' ' + TH_MONTHS[d.getMonth()] + ' ' + y;
}
/* ข้อความช่วงวันที่ */
function fmtRange(from, to) {
  if (!from && !to) return '';
  if (from && to && from === to) return 'วันที่ ' + fmtDateLong(from);
  if (from && to) return 'ระหว่างวันที่ ' + fmtDateLong(from) + ' ถึง ' + fmtDateLong(to);
  if (from) return 'ตั้งแต่วันที่ ' + fmtDateLong(from);
  return 'ถึงวันที่ ' + fmtDateLong(to);
}
/* บวก/ลบวันจาก yyyy-mm-dd */
function addDays(dateStr, n) {
  const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

/* ---------- จำนวนเงินเป็นตัวอักษร (ใช้ในเอกสารที่พิมพ์) ---------- */
const TH_DIGIT = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const TH_PLACE = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
function readThaiNumber(numStr) {
  numStr = String(numStr).replace(/^0+/, '');
  if (!numStr) return '';
  if (numStr.length > 7) {
    return readThaiNumber(numStr.slice(0, numStr.length - 6)) + 'ล้าน' + readThaiNumber(numStr.slice(-6));
  }
  let out = '';
  const len = numStr.length;
  for (let i = 0; i < len; i++) {
    const d = +numStr[i];
    const pos = len - i - 1;
    if (d === 0) continue;
    if (pos === 0 && d === 1 && len > 1) out += 'เอ็ด';
    else if (pos === 1 && d === 1) out += 'สิบ';
    else if (pos === 1 && d === 2) out += 'ยี่สิบ';
    else out += TH_DIGIT[d] + TH_PLACE[pos];
  }
  return out;
}
function bahtText(amount) {
  const v = Math.round((Number(amount) || 0) * 100) / 100;
  const sign = v < 0 ? 'ลบ' : '';
  const parts = Math.abs(v).toFixed(2).split('.');
  const baht = readThaiNumber(parts[0]) || 'ศูนย์';
  const satang = +parts[1];
  return sign + baht + 'บาท' + (satang ? readThaiNumber(parts[1]) + 'สตางค์' : 'ถ้วน');
}

/* ---------- สี ---------- */
function hexToSoft(hex, a) {
  if (!hex || hex[0] !== '#') return 'var(--brand-soft)';
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a === undefined ? 0.13 : a})`;
}

/* ============================ ข้อมูลตั้งต้น (ประเภทแผน / หน่วยนับ / ปีงบ) ============================ */
const Master = {
  cats: [], units: [], year: 0, years: [], blockOver: true, loaded: false,

  async load(force) {
    if (this.loaded && !force) return true;
    const r = await api('getMasters').catch(() => null);
    if (!r || r.status !== 'success') return false;
    this.cats = r.categories || [];
    this.units = r.units || [];
    this.years = r.years || [];
    this.blockOver = r.block_over_plan !== false;
    if (!App.fiscalYear) App.fiscalYear = r.fiscal_year;
    this.year = r.fiscal_year;
    this.loaded = true;
    return true;
  },

  cat(id) { return this.cats.find(c => c.id === id) || null; },
  catName(id) { const c = this.cat(id); return c ? c.name : 'ไม่ระบุประเภท'; },
  catColor(id) { const c = this.cat(id); return (c && c.color) || '#6D3FD6'; },

  catOptions(sel, placeholder) {
    const ph = placeholder === null ? '' : `<option value="">${App.esc(placeholder || '-- เลือกประเภทแผน --')}</option>`;
    return ph + this.cats.map(c =>
      `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${App.esc(c.name)}</option>`).join('');
  },

  unitOptions(sel) {
    const has = this.units.some(u => u.name === sel);
    return `<option value="">-- เลือกหน่วยนับ --</option>` +
      this.units.map(u => `<option value="${App.esc(u.name)}" ${u.name === sel ? 'selected' : ''}>${App.esc(u.name)}</option>`).join('') +
      (sel && !has ? `<option value="${App.esc(sel)}" selected>${App.esc(sel)}</option>` : '');
  },

  yearOptions(sel) {
    const list = this.years.slice();
    if (sel && list.indexOf(sel) === -1) list.push(sel);
    list.sort((a, b) => b - a);
    return list.map(y => `<option value="${y}" ${y === sel ? 'selected' : ''}>พ.ศ. ${y}</option>`).join('');
  }
};

/* ============================ App ============================ */
const App = {
  token: localStorage.getItem('tw_token') || '',
  user: null,
  branding: { hospital_name: 'The Watcher', logo_url: '', app_version: '' },
  beYear: true,
  fiscalYear: 0,
  tab: 'home',

  /* ---------- ธีม ---------- */
  setTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    try { localStorage.setItem('tw_theme', dark ? 'dark' : 'light'); } catch (e) {}
    const m = document.querySelector('meta[name=theme-color]');
    if (m) m.setAttribute('content', dark ? '#1c1630' : '#5b3fc2');
  },
  isDark() { try { return localStorage.getItem('tw_theme') === 'dark'; } catch (e) { return false; } },

  /* ---------- สิทธิ์ ---------- */
  can(perm) {
    const p = (this.user && this.user.permissions) || [];
    return p.indexOf('*') !== -1 || p.indexOf(perm) !== -1;
  },
  isAdmin() { return this.can('*'); },

  /* ---------- boot ---------- */
  async boot() {
    this.showLoading('กำลังเชื่อมต่อ');
    try {
      try {
        const b = await api('branding');
        if (b && b.branding) {
          this.branding = b.branding;
          this.beYear = b.branding.display_be !== false;
          this.fiscalYear = b.branding.fiscal_year || 0;
        }
      } catch (e) { /* แสดง login ได้แม้ branding ล้ม */ }

      this.paintLoginBrand();

      if (this.token) {
        const me = await api('me').catch(() => null);
        if (me && me.status === 'success') {
          this.user = me.user;
          await this.enterApp();
          return;
        }
        this.token = '';
        localStorage.removeItem('tw_token');
      }
      this.showLogin();
    } finally {
      this.hideLoading();
    }
  },

  /* ---------- login ---------- */
  paintLoginBrand() {
    const mark = document.querySelector('#login .brandmark');
    mark.innerHTML = this.branding.logo_url
      ? `<img src="${this.branding.logo_url}" alt="logo">`
      : `<i class="bi bi-clipboard2-check-fill"></i>`;
    document.querySelector('#login h1').textContent = this.branding.hospital_name || 'The Watcher';
  },

  showLogin() {
    document.getElementById('login').style.display = 'flex';
    document.getElementById('main').classList.add('d-none');
  },

  async doLogin() {
    const u = document.getElementById('liUser').value.trim();
    const p = document.getElementById('liPass').value;
    const err = document.getElementById('liErr');
    const btn = document.getElementById('liBtn');
    err.textContent = '';
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
    try {
      const r = await api('login', { username: u, password: p });
      if (r.status === 'success') {
        this.token = r.token; this.user = r.user;
        localStorage.setItem('tw_token', r.token);
        await this.enterApp();
      } else {
        err.textContent = r.message || 'เข้าสู่ระบบไม่สำเร็จ';
      }
    } catch (e) {
      err.textContent = e.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้';
    } finally {
      btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ';
    }
  },

  handleAuthExpired() {
    this.token = ''; this.user = null;
    Master.loaded = false;
    localStorage.removeItem('tw_token');
    this.showLogin();
    this.toast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', 'err');
  },

  async logout() {
    try { await api('logout'); } catch (e) {}
    this.token = ''; this.user = null;
    Master.loaded = false;
    localStorage.removeItem('tw_token');
    this.showLogin();
  },

  /* ---------- app shell ---------- */
  async enterApp() {
    document.getElementById('login').style.display = 'none';
    document.getElementById('main').classList.remove('d-none');
    this.showLoading('กำลังโหลดข้อมูล');
    try { await Master.load(true); } finally { this.hideLoading(); }
    this.renderHeader();
    this.renderNav();
    this.navigate('home');
  },

  renderHeader() {
    const box = document.getElementById('hLogo');
    box.innerHTML = this.branding.logo_url
      ? `<img src="${this.branding.logo_url}" alt="logo">`
      : `<i class="bi bi-clipboard2-check-fill"></i>`;
    document.getElementById('hTitle').textContent = this.branding.hospital_name || 'The Watcher';
    const sub = document.querySelector('#appHeader .h-sub');
    if (sub) sub.textContent = 'ระบบติดตามแผนจัดซื้อ · ปีงบ ' + this.fyText();
  },

  /* เมนูล่าง/แถบข้าง สร้างตามสิทธิ์ */
  navItems() {
    if (this.isAdmin()) {
      return [
        { tab: 'home',     icon: 'bi-house-door-fill',        label: 'หน้าหลัก' },
        { tab: 'plans',    icon: 'bi-collection-fill',        label: 'ประเภทแผน' },
        { tab: 'plan',     icon: 'bi-journal-plus',           label: 'แผนประจำปี', fab: true },
        { tab: 'purchase', icon: 'bi-cart-check-fill',        label: 'ขออนุมัติซื้อ' },
        { tab: 'result',   icon: 'bi-bar-chart-line-fill',    label: 'ผลตามแผน' },
        { tab: 'report',   icon: 'bi-file-earmark-text-fill', label: 'รายงาน', desk: true },
        { tab: 'settings', icon: 'bi-gear-fill',              label: 'ตั้งค่า', desk: true, last: true }
      ];
    }
    return [
      { tab: 'home',     icon: 'bi-house-door-fill',     label: 'หน้าหลัก' },
      { tab: 'purchase', icon: 'bi-cart-check-fill',     label: 'ขออนุมัติซื้อ', fab: true },
      { tab: 'result',   icon: 'bi-bar-chart-line-fill', label: 'ผลตามแผน' },
      { tab: 'settings', icon: 'bi-gear-fill',           label: 'ตั้งค่า', desk: true, last: true }
    ];
  },

  renderNav() {
    const nav = document.getElementById('bottomNav');
    const items = this.navItems();
    nav.innerHTML = items.map(it => {
      if (it.fab) {
        return `<div class="fab-wrap">
          <button class="fab nav-btn" data-tab="${it.tab}" aria-label="${this.esc(it.label)}">
            <i class="bi ${it.icon}"></i><span class="fab-text">${this.esc(it.label)}</span></button>
          <span class="fab-label">${this.esc(it.label)}</span>
        </div>`;
      }
      const cls = 'nav-btn' + (it.desk ? ' nav-desk-only' : '') + (it.last ? ' nav-last' : '');
      return `<button class="${cls}" data-tab="${it.tab}">
        <i class="bi ${it.icon}"></i><span>${this.esc(it.label)}</span></button>`;
    }).join('');

    // กริดมือถือให้พอดีกับจำนวนปุ่มที่แสดงจริง
    const mobileCount = items.filter(it => !it.desk).length;
    nav.style.setProperty('--nav-cols', mobileCount);

    nav.querySelectorAll('.nav-btn').forEach(b => {
      b.addEventListener('click', () => this.navigate(b.dataset.tab));
    });
  },

  navigate(tab) {
    const allowed = this.navItems().map(i => i.tab);
    if (allowed.indexOf(tab) === -1 && tab !== 'settings') tab = 'home';
    this.tab = tab;
    document.querySelectorAll('#bottomNav .nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    const hSet = document.getElementById('hSettings');
    if (hSet) hSet.classList.toggle('active', tab === 'settings');

    const view = document.getElementById('view');
    const map = {
      home: viewHome,
      plans: viewPlanCategories,
      plan: viewPlan,
      purchase: viewPurchase,
      result: viewResult,
      report: viewReport,
      settings: v => Settings.render(v)
    };
    (map[tab] || viewHome)(view);
    window.scrollTo(0, 0);
  },

  /* ---------- ปีงบประมาณ ---------- */
  fyText() { return 'พ.ศ. ' + (this.fiscalYear || Master.year || '-'); },
  fyTitle() { return 'แผนประจำปีงบประมาณ ' + this.fyText(); },

  /* ปุ่มเลือกปีงบ (ใช้ซ้ำได้ทุกหน้า) */
  yearPill(id) {
    return `<button class="year-pill" id="${id || 'yearPill'}">
      <i class="bi bi-calendar2-range"></i><span>ปีงบ ${this.fiscalYear || '-'}</span>
      <i class="bi bi-chevron-down" style="font-size:12px;opacity:.7"></i></button>`;
  },

  bindYearPill(id, onChange) {
    const btn = document.getElementById(id || 'yearPill');
    if (btn) btn.addEventListener('click', () => this.openYearSheet(onChange));
  },

  openYearSheet(onChange) {
    const years = Master.years.slice();
    if (this.fiscalYear && years.indexOf(this.fiscalYear) === -1) years.push(this.fiscalYear);
    years.sort((a, b) => b - a);

    const body = this.openSheet('ปีงบประมาณ', `
      <div class="hint" style="margin:0 0 12px">เลือกปีงบประมาณที่ต้องการดู/บันทึกข้อมูล</div>
      <div id="ySheetList">${years.map(y => `
        <button class="menu-item" data-y="${y}">
          <div class="mi-icon c-indigo"><i class="bi bi-calendar2-range"></i></div>
          <div class="mi-body"><div class="mi-title">ปีงบประมาณ พ.ศ. ${y}</div></div>
          ${y === this.fiscalYear ? '<i class="bi bi-check-lg" style="color:var(--brand-strong);font-size:20px"></i>' : ''}
        </button>`).join('')}</div>
      ${this.isAdmin() ? `
      <div class="section-label" style="margin:18px 4px 10px">เพิ่มปีงบประมาณ</div>
      <div class="field" style="margin-bottom:10px">
        <div class="d-flex gap-2">
          <input type="number" id="yNew" placeholder="เช่น ${(Master.year || 2569) + 1}" inputmode="numeric" style="flex:1">
          <button class="btn-ghost" id="yAdd" style="width:auto;flex:none">เพิ่ม</button>
        </div>
        <div class="hint">ใส่เป็น พ.ศ. · ระบบจะตั้งเป็นปีงบเริ่มต้นให้ด้วย</div>
      </div>` : ''}`);

    body.querySelectorAll('[data-y]').forEach(b => b.addEventListener('click', () => {
      this.setYear(parseInt(b.dataset.y, 10), onChange);
    }));

    const addBtn = body.querySelector('#yAdd');
    if (addBtn) addBtn.addEventListener('click', async () => {
      const v = parseInt(body.querySelector('#yNew').value, 10);
      if (!v || v < 2400 || v > 2700) { this.invalid(body.querySelector('#yNew'), 'ใส่ปีเป็น พ.ศ. เช่น 2569'); return; }
      if (Master.years.indexOf(v) === -1) Master.years.push(v);
      await this.setYear(v, onChange);
    });
  },

  async setYear(y, onChange) {
    if (!y) return;
    this.fiscalYear = y;
    this.closeSheet();
    this.renderHeader();
    if (this.isAdmin()) {
      const r = await api('setFiscalYear', { fiscal_year: y }).catch(() => null);
      if (r && r.status === 'success') { Master.year = y; this.toast(r.message, 'ok'); }
    } else {
      this.toast('ดูข้อมูลปีงบ ' + y);
    }
    if (typeof onChange === 'function') onChange(y);
  },

  /* ---------- toast ---------- */
  toast(msg, type) {
    const host = document.getElementById('toastHost');
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  },

  esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },

  /* ---------- loading + validation ---------- */
  loader(text) {
    return `<div class="loader-block"><span class="spin spin-brand"></span><span>${App.esc(text || 'กำลังโหลด')}</span></div>`;
  },
  showLoading(text) {
    const o = document.getElementById('loadingOverlay');
    if (!o) return;
    o.querySelector('.lo-text').textContent = text || 'กำลังโหลด';
    o.classList.add('show');
  },
  hideLoading() {
    const o = document.getElementById('loadingOverlay');
    if (o) o.classList.remove('show');
  },
  invalid(el, msg) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) { if (msg) App.toast(msg, 'err'); return; }
    el.classList.add('is-invalid');
    el.addEventListener('input', () => el.classList.remove('is-invalid'), { once: true });
    el.addEventListener('change', () => el.classList.remove('is-invalid'), { once: true });
    if (msg) App.toast(msg, 'err');
    try { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
  },

  /* ---------- bottom sheet / modal ---------- */
  openSheet(title, bodyHtml) {
    App.closeSheet();
    const o = document.createElement('div');
    o.className = 'sheet-overlay'; o.id = 'appSheet';
    o.innerHTML = `<div class="sheet"><div class="sheet-head"><span>${App.esc(title)}</span>
      <button class="sheet-x" id="sheetX"><i class="bi bi-x-lg"></i></button></div>
      <div class="sheet-body">${bodyHtml}</div></div>`;
    document.body.appendChild(o);
    o.addEventListener('click', e => { if (e.target === o) App.closeSheet(); });
    o.querySelector('#sheetX').addEventListener('click', () => App.closeSheet());
    requestAnimationFrame(() => o.classList.add('show'));
    return o.querySelector('.sheet-body');
  },
  closeSheet() {
    const o = document.getElementById('appSheet');
    if (o) o.remove();
  },

  confirm(title, message, okLabel) {
    return new Promise(resolve => {
      const body = App.openSheet(title, `
        <p style="margin:0 0 18px;line-height:1.7">${App.esc(message)}</p>
        <button class="btn-brand" id="cfOk">${App.esc(okLabel || 'ยืนยัน')}</button>
        <button class="btn-ghost" id="cfNo" style="width:100%;margin-top:10px">ยกเลิก</button>`);
      let done = false;
      const finish = v => { if (done) return; done = true; App.closeSheet(); resolve(v); };
      body.querySelector('#cfOk').addEventListener('click', () => finish(true));
      body.querySelector('#cfNo').addEventListener('click', () => finish(false));
      document.getElementById('appSheet').addEventListener('click', e => {
        if (e.target.id === 'appSheet') finish(false);
      });
    });
  }
};

/* ============================ ทะเบียนรายการ: ใส่รหัส -> ดึงชื่อ/หน่วยนับ ============================ */
/* "ช่องสีแดง" ตามเอกสาร = รหัสรายการ / ชื่อ / หน่วยนับ  บันทึกครั้งแรกครั้งเดียว
   ครั้งต่อ ๆ ไปใส่รหัสแล้วระบบดึง 3 ไอเทมนี้ขึ้นมาให้ */
const ProductLookup = {
  /* html ของกลุ่มช่อง รหัส/ชื่อ/หน่วยนับ */
  fieldsHtml(prefix, v, opts) {
    v = v || {};
    opts = opts || {};
    const ro = opts.readonly ? 'readonly' : '';
    return `
      <div class="field">
        <label>รหัสรายการ <span class="req">*</span></label>
        <div class="code-row">
          <input type="text" id="${prefix}Code" value="${App.esc(v.code || '')}" autocomplete="off" placeholder="เช่น 123456789">
          <button type="button" class="code-find" id="${prefix}Find" title="ค้นหารายการ"><i class="bi bi-search"></i></button>
        </div>
        <div class="hint" id="${prefix}CodeHint">ใส่รหัสแล้วกดออกจากช่อง ระบบจะดึงชื่อและหน่วยนับให้อัตโนมัติ</div>
      </div>
      <div class="field">
        <label>ชื่อ <span class="req">*</span></label>
        <input type="text" id="${prefix}Name" value="${App.esc(v.name || '')}" autocomplete="off" placeholder="เช่น Paracetamol 500 mg" ${ro}>
      </div>
      <div class="field">
        <label>หน่วยนับ <span class="req">*</span></label>
        <select id="${prefix}Unit" ${opts.readonly ? 'disabled' : ''}>${Master.unitOptions(v.unit || '')}</select>
      </div>`;
  },

  /* ผูก event: blur ที่ช่องรหัส -> lookup, ปุ่มแว่นขยาย -> ค้นหา */
  bind(prefix, onFound) {
    const code = document.getElementById(prefix + 'Code');
    const find = document.getElementById(prefix + 'Find');
    if (code) {
      code.addEventListener('blur', () => this.lookup(prefix, onFound));
      code.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); this.lookup(prefix, onFound); }
      });
    }
    if (find) find.addEventListener('click', () => this.openSearch(prefix, onFound));
  },

  async lookup(prefix, onFound) {
    const codeEl = document.getElementById(prefix + 'Code');
    const hint = document.getElementById(prefix + 'CodeHint');
    if (!codeEl) return null;
    const code = codeEl.value.trim();
    if (!code) return null;

    if (hint) hint.textContent = 'กำลังค้นหารหัส...';
    const r = await api('findProductByCode', { code }).catch(() => null);
    if (r && r.found && r.data) {
      this.fill(prefix, r.data);
      if (hint) hint.innerHTML = '<span class="ok-hint"><i class="bi bi-check-circle-fill"></i> ดึงข้อมูลจากทะเบียนรายการแล้ว</span>';
      if (typeof onFound === 'function') onFound(r.data, true);
      return r.data;
    }
    if (hint) hint.innerHTML = '<span class="new-hint"><i class="bi bi-plus-circle"></i> รหัสใหม่ กรอกชื่อและหน่วยนับเพื่อบันทึกเข้าทะเบียน</span>';
    if (typeof onFound === 'function') onFound(null, false);
    return null;
  },

  fill(prefix, d) {
    const n = document.getElementById(prefix + 'Name');
    const u = document.getElementById(prefix + 'Unit');
    const c = document.getElementById(prefix + 'Code');
    if (c && d.code) c.value = d.code;
    if (n) n.value = d.name || '';
    if (u) {
      if (!Array.from(u.options).some(o => o.value === d.unit) && d.unit) {
        u.insertAdjacentHTML('beforeend', `<option value="${App.esc(d.unit)}">${App.esc(d.unit)}</option>`);
      }
      u.value = d.unit || '';
    }
  },

  values(prefix) {
    return {
      code: (document.getElementById(prefix + 'Code') || {}).value || '',
      name: (document.getElementById(prefix + 'Name') || {}).value || '',
      unit: (document.getElementById(prefix + 'Unit') || {}).value || ''
    };
  },

  openSearch(prefix, onFound) {
    const body = App.openSheet('ค้นหารายการในทะเบียน', `
      <div class="search-wrap" style="margin-top:0">
        <i class="bi bi-search"></i>
        <input id="plQ" autocomplete="off" placeholder="พิมพ์รหัส หรือ ชื่อรายการ">
      </div>
      <div id="plRes" style="margin-top:14px"><div class="hint">พิมพ์เพื่อค้นหา</div></div>`);

    const input = body.querySelector('#plQ');
    const res = body.querySelector('#plRes');
    let timer = null;

    const run = async () => {
      const q = input.value.trim();
      res.innerHTML = '<div class="hint">กำลังค้นหา...</div>';
      const r = await api('searchProducts', { q }).catch(() => null);
      const list = (r && r.data) || [];
      if (!list.length) { res.innerHTML = '<div class="hint">ไม่พบรายการ</div>'; return; }
      res.innerHTML = list.map(p => `
        <button class="menu-item" data-code="${App.esc(p.code)}">
          <div class="mi-icon c-indigo"><i class="bi bi-upc"></i></div>
          <div class="mi-body">
            <div class="mi-title">${App.esc(p.name)}</div>
            <div class="mi-desc">${App.esc(p.code)} · ${App.esc(p.unit || '-')}</div>
          </div>
          <i class="bi bi-chevron-right mi-arrow"></i>
        </button>`).join('');
      res.querySelectorAll('[data-code]').forEach(b => b.addEventListener('click', () => {
        const p = list.find(x => x.code === b.dataset.code);
        App.closeSheet();
        this.fill(prefix, p);
        const hint = document.getElementById(prefix + 'CodeHint');
        if (hint) hint.innerHTML = '<span class="ok-hint"><i class="bi bi-check-circle-fill"></i> ดึงข้อมูลจากทะเบียนรายการแล้ว</span>';
        if (typeof onFound === 'function') onFound(p, true);
      }));
    };

    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 300); });
    setTimeout(() => { try { input.focus(); } catch (e) {} run(); }, 80);
  }
};

/* ============================ ชิ้นส่วน UI ที่ใช้ร่วมกัน ============================ */

/* แถบความคืบหน้าการใช้วงเงิน */
function progressBar(pct, color) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const c = p >= 100 ? 'var(--danger)' : (p >= 90 ? 'oklch(0.72 0.16 60)' : (color || 'var(--brand)'));
  return `<div class="pbar"><span style="width:${p}%;background:${c}"></span></div>`;
}

/* แถวสรุป แผน / ซื้อแล้ว / คงเหลือ */
function triStat(planAmt, usedAmt, remainAmt) {
  return `<div class="tri-stat">
    <div><div class="ts-label">วงเงินตามแผน</div><div class="ts-val num">${money(planAmt)}</div></div>
    <div><div class="ts-label">ขอซื้อแล้ว</div><div class="ts-val num ts-used">${money(usedAmt)}</div></div>
    <div><div class="ts-label">คงเหลือ</div><div class="ts-val num ${remainAmt < 0 ? 'ts-over' : 'ts-remain'}">${money(remainAmt)}</div></div>
  </div>`;
}

function emptyState(title, note, icon) {
  return `<div class="empty-state" style="padding:50px 20px">
    <div class="es-icon"><i class="bi ${icon || 'bi-inbox'}"></i></div>
    <div class="es-title">${App.esc(title)}</div>
    ${note ? `<div>${App.esc(note)}</div>` : ''}</div>`;
}

/* ============================ boot ============================ */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('liBtn').addEventListener('click', () => App.doLogin());
  document.getElementById('liPass').addEventListener('keydown', e => { if (e.key === 'Enter') App.doLogin(); });
  const hSet = document.getElementById('hSettings');
  if (hSet) hSet.addEventListener('click', () => App.navigate('settings'));
  App.boot();
});
