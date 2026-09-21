/* exchange.js - พาร์ท 5: แลกยา / ย้ายระหว่างสถานที่ */
const Exchange = {
  _view: null, _locs: [], _recent: [], selected: null, pendingItem: null, _timer: null,

  async render(view) {
    this._view = view; this.selected = null;
    view.innerHTML = `<div class="page-title">แลกยา</div><div id="exBody">${App.loader()}</div>`;

    const [rl, rx] = await Promise.all([api('getLocations').catch(() => null), api('recentExchanges', { limit: 15 }).catch(() => null)]);
    this._locs = ((rl && rl.data) || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    this._recent = (rx && rx.data) || [];

    if (this.pendingItem) { const it = this.pendingItem; this.pendingItem = null; this.start(it); return; }
    this.paintPick();
  },

  /* ---------- เลือกยาที่จะย้าย ---------- */
  paintPick() {
    document.getElementById('exBody').innerHTML = `
      <div class="page-sub">ค้นหายาที่ต้องการย้าย แล้วเลือกสถานที่ปลายทาง</div>
      <div class="search-wrap">
        <i class="bi bi-search"></i>
        <input id="exSearch" autocomplete="off" placeholder="ค้นหาชื่อยา, สถานที่, Lot, บาร์โค้ด">
      </div>
      <div id="exList" style="margin-top:14px"></div>
      <div class="section-label">ย้ายล่าสุด</div>
      <div id="exRecent">${this._recent.length ? this.recentHtml() : '<div class="hint">ยังไม่มีรายการ</div>'}</div>`;

    const input = document.getElementById('exSearch');
    input.addEventListener('input', () => {
      const q = input.value.trim();
      clearTimeout(this._timer);
      if (!q) { document.getElementById('exList').innerHTML = ''; return; }
      this._timer = setTimeout(() => this.search(q), 300);
    });
  },

  async search(q) {
    const wrap = document.getElementById('exList');
    if (!wrap) return;
    wrap.innerHTML = '<div class="hint">กำลังค้นหา...</div>';
    const r = await api('searchItems', { q }).catch(() => null);
    const list = (r && r.data) || [];
    if (!list.length) { wrap.innerHTML = '<div class="hint">ไม่พบรายการ</div>'; return; }
    wrap.innerHTML = list.map(it => {
      const b = expiryBucket(it.days);
      return `<button class="menu-item" data-id="${it.id}">
        ${drugThumb(it.image_url)}
        <div class="mi-body"><div class="mi-title">${App.esc(it.drug_name)}</div>
          <div class="mi-desc">${App.esc(it.location_name || '')} · จำนวน ${it.qty}${it.lot_no ? ' · Lot ' + App.esc(it.lot_no) : ''}</div></div>
        <span class="chip ${b.cls}">${b.label}</span>
      </button>`;
    }).join('');
    wrap.querySelectorAll('.menu-item').forEach(b => b.addEventListener('click', () => {
      const it = list.find(x => x.id === b.dataset.id);
      this.start(it);
    }));
  },

  /* ---------- ฟอร์มย้าย ---------- */
  start(item) {
    this.selected = item;
    const destOpts = this._locs.filter(l => l.id !== item.location_id)
      .map(l => `<option value="${l.id}">${App.esc(l.name)}</option>`).join('');
    const b = expiryBucket(item.days);

    document.getElementById('exBody').innerHTML = `
      <button class="btn-ghost" style="width:auto;margin-bottom:16px" id="exBack"><i class="bi bi-chevron-left"></i> กลับ</button>

      <div class="card-soft" style="padding:14px 16px;margin-bottom:18px">
        <div class="d-flex align-items-start gap-2">
          ${drugThumb(item.image_url)}
          <div style="flex:1;min-width:0"><div style="font-weight:600">${App.esc(item.drug_name)}</div>
            <div class="hint" style="margin:2px 0 0">จาก ${App.esc(item.location_name || '')} · มี ${item.qty}${item.lot_no ? ' · Lot ' + App.esc(item.lot_no) : ''}</div></div>
          <span class="chip ${b.cls}">${b.label}</span>
        </div>
      </div>

      <div class="field"><label>ย้ายไปที่ <span style="color:var(--danger)">*</span></label>
        <select id="exDest">${destOpts || '<option value="">ไม่มีสถานที่อื่น</option>'}</select></div>

      <div class="field"><label>จำนวนที่ย้าย <span style="color:var(--danger)">*</span></label>
        <div class="qty-row">
          <button type="button" class="qty-btn" id="exMinus">-</button>
          <input type="number" id="exQty" value="${item.qty}" min="1" max="${item.qty}" inputmode="numeric">
          <span class="qty-unit">/ ${item.qty}</span>
          <button type="button" class="qty-btn" id="exPlus">+</button>
        </div></div>

      <button id="exConfirm" class="btn-brand"><i class="bi bi-arrow-left-right"></i> ยืนยันการย้าย</button>`;

    document.getElementById('exBack').addEventListener('click', () => this.paintPick());
    const q = document.getElementById('exQty');
    document.getElementById('exMinus').addEventListener('click', () => { q.value = Math.max(1, (parseInt(q.value) || 1) - 1); });
    document.getElementById('exPlus').addEventListener('click', () => { q.value = Math.min(item.qty, (parseInt(q.value) || 0) + 1); });
    document.getElementById('exConfirm').addEventListener('click', (e) => this.confirm(e.currentTarget));
  },

  async confirm(btn) {
    const item = this.selected;
    const dest = document.getElementById('exDest').value;
    const qty = parseInt(document.getElementById('exQty').value) || 0;
    if (!dest) { App.toast('ไม่มีสถานที่ปลายทาง', 'err'); return; }
    if (qty <= 0 || qty > item.qty) { App.toast('จำนวนไม่ถูกต้อง', 'err'); return; }

    btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
    const r = await api('exchangeItem', { item_id: item.id, to_location_id: dest, qty }).catch(() => null);
    btn.disabled = false; btn.innerHTML = '<i class="bi bi-arrow-left-right"></i> ยืนยันการย้าย';
    if (r && r.status === 'success') {
      App.toast(r.message, 'ok');
      if (navigator.vibrate) navigator.vibrate(40);
      this.selected = null;
      this.render(this._view);
    } else App.toast((r && r.message) || 'ย้ายไม่สำเร็จ', 'err');
  },

  recentHtml() {
    return this._recent.map(t => `
      <div class="scan-row">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600">${App.esc(t.drug_name)}</div>
          <div class="hint" style="margin:2px 0 0">${App.esc(t.from_location_name || '')} <i class="bi bi-arrow-right"></i> ${App.esc(t.to_location_name || '')}</div>
        </div>
        <div class="num" style="color:var(--brand-strong)">${t.qty}</div>
      </div>`).join('');
  }
};

function viewExchange(view) { Exchange.render(view); }
