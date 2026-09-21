/* stock.js - พาร์ท 5: ยาแต่ละจุด (การ์ดต่อสถานที่ + รายการในจุด) */
const Stock = {
  _view: null,
  _curLoc: null,

  async grid(view) {
    this._view = view;
    view.innerHTML = `
      <div class="page-title">ยาแต่ละจุด</div>
      <div class="page-sub">เลือกสถานที่เพื่อจัดการรายการ</div>
      <div id="stockGrid" class="loc-grid">${App.loader()}</div>`;

    const r = await api('getLocationStock').catch(() => null);
    const wrap = document.getElementById('stockGrid');
    if (!r || r.status !== 'success') { wrap.innerHTML = '<div class="hint">โหลดข้อมูลไม่ได้</div>'; return; }

    const tiles = [this.tileHtml({ id: 'all', name: 'รวมทุกสถานที่', icon: 'box', color: '#16A34A', count: r.all.count, qty: r.all.qty }, true)]
      .concat(r.locations.map(l => this.tileHtml(l, false)));
    wrap.innerHTML = tiles.join('');

    wrap.querySelectorAll('.loc-tile').forEach(t => t.addEventListener('click', () =>
      this.detail(view, t.dataset.id, t.dataset.name)));
  },

  tileHtml(l, isAll) {
    const soft = hexToSoft(l.color);
    return `<button class="loc-tile" data-id="${l.id}" data-name="${App.esc(l.name)}">
      <div class="lt-top">
        <div class="mi-icon" style="background:${soft};color:${l.color}"><i class="bi ${iconClass(l.icon)}"></i></div>
        <div class="lt-count num">${l.count}</div>
      </div>
      <div class="lt-name">${App.esc(l.name)}</div>
      <div class="lt-qty">รวมจำนวน ${l.qty}</div>
    </button>`;
  },

  async detail(view, locId, locName) {
    this._view = view; this._curLoc = { id: locId, name: locName };
    view.innerHTML = `
      <button class="btn-ghost" style="width:auto;margin-bottom:16px" id="stBack"><i class="bi bi-chevron-left"></i> กลับ</button>
      <div class="page-title">${App.esc(locName)}</div>
      <div class="page-sub">รายการยาในจุดนี้ เรียงตามวันใกล้หมดอายุ</div>
      <div id="stItems">${App.loader()}</div>`;
    document.getElementById('stBack').addEventListener('click', () => this.grid(view));

    const r = await api('getLocationItems', { location_id: locId }).catch(() => null);
    const wrap = document.getElementById('stItems');
    const list = (r && r.data) || [];
    if (!list.length) { wrap.innerHTML = '<div class="empty-state"><div class="es-title">ยังไม่มียาในจุดนี้</div></div>'; return; }

    wrap.innerHTML = list.map(it => {
      const b = expiryBucket(it.days);
      return `<div class="card-soft" style="padding:14px 16px;margin-bottom:12px">
        <div class="d-flex align-items-start gap-2">
          ${drugThumb(it.image_url)}
          <div style="flex:1;min-width:0">
            <div style="font-weight:600">${App.esc(it.drug_name)}</div>
            <div class="hint" style="margin:2px 0 0">${App.esc(it.location_name || '')} · จำนวน ${it.qty}${it.lot_no ? ' · Lot ' + App.esc(it.lot_no) : ''}</div>
          </div>
          <div style="text-align:right">
            <span class="chip ${b.cls}">${b.label}</span>
            <div class="hint" style="margin:3px 0 0">${fmtDate(it.expiry_date)}</div>
          </div>
        </div>
        <div class="d-flex gap-2 mt-2">
          <button class="btn-ghost" style="width:auto" data-move="${it.id}"><i class="bi bi-arrow-left-right"></i> ย้าย</button>
          <button class="btn-ghost" style="width:auto;background:transparent;color:var(--danger)" data-dispose="${it.id}"><i class="bi bi-dash-circle"></i> ตัดจ่าย / ทิ้ง</button>
        </div>
      </div>`;
    }).join('');

    wrap.querySelectorAll('[data-move]').forEach(btn => btn.addEventListener('click', () => {
      const it = list.find(x => x.id === btn.dataset.move);
      Exchange.pendingItem = it;
      App.navigate('exchange');
    }));
    wrap.querySelectorAll('[data-dispose]').forEach(btn => btn.addEventListener('click', () => {
      const it = list.find(x => x.id === btn.dataset.dispose);
      this.dispose(it);
    }));
  },

  dispose(it) {
    const body = App.openSheet('ตัดจ่าย / ทิ้งยา', `
      <div style="font-weight:600;margin-bottom:2px">${App.esc(it.drug_name)}</div>
      <div class="hint" style="margin:0 0 14px">${App.esc(it.location_name || '')} · มี ${it.qty}${it.lot_no ? ' · Lot ' + App.esc(it.lot_no) : ''}</div>
      <div class="field"><label>เหตุผล</label>
        <select id="dsReason">
          <option>เบิกใช้</option><option>หมดอายุ</option><option>ชำรุด/เสียหาย</option><option>อื่นๆ</option>
        </select></div>
      <div class="field"><label>จำนวน</label>
        <div class="qty-row">
          <button type="button" class="qty-btn" id="dsMinus">-</button>
          <input type="number" id="dsQty" value="1" min="1" max="${it.qty}" inputmode="numeric">
          <span class="qty-unit">/ ${it.qty}</span>
          <button type="button" class="qty-btn" id="dsPlus">+</button>
        </div></div>
      <div class="field"><label>หมายเหตุ (ถ้ามี)</label><input type="text" id="dsNote" autocomplete="off"></div>
      <button id="dsGo" class="btn-brand"><i class="bi bi-check2"></i> ยืนยันตัดจ่าย</button>`);

    const q = body.querySelector('#dsQty');
    body.querySelector('#dsMinus').addEventListener('click', () => { q.value = Math.max(1, (parseInt(q.value) || 1) - 1); });
    body.querySelector('#dsPlus').addEventListener('click', () => { q.value = Math.min(it.qty, (parseInt(q.value) || 0) + 1); });
    body.querySelector('#dsGo').addEventListener('click', async (e) => {
      const qty = parseInt(q.value) || 0;
      if (qty <= 0 || qty > it.qty) { App.toast('จำนวนไม่ถูกต้อง', 'err'); return; }
      const reason = body.querySelector('#dsReason').value;
      const note = body.querySelector('#dsNote').value.trim();
      const btn = e.currentTarget; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
      const r = await api('disposeItem', { item_id: it.id, qty, reason, note }).catch(() => null);
      if (r && r.status === 'success') {
        App.closeSheet(); App.toast(r.message, 'ok');
        if (this._curLoc) this.detail(this._view, this._curLoc.id, this._curLoc.name);
      } else { btn.disabled = false; btn.innerHTML = '<i class="bi bi-check2"></i> ยืนยันตัดจ่าย'; App.toast((r && r.message) || 'ตัดจ่ายไม่สำเร็จ', 'err'); }
    });
  }
};

function viewLocations(view) { Stock.grid(view); }
