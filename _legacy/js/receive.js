/* receive.js - พาร์ท 3: ฟอร์มรับเข้ายา (เลือกยา > Lot > วันหมดอายุ > จำนวน > สถานที่) */
const Receive = {
  _view: null, _drugs: [], _locs: [], _recent: [], selected: null, defaultLocId: '',

  async render(view) {
    this._view = view; this.selected = null;
    view.innerHTML = `<div class="page-title">รับเข้า</div><div id="rcvBody">${App.loader()}</div>`;
    const [rd, rl] = await Promise.all([api('getDrugs').catch(() => null), api('getLocations').catch(() => null)]);
    this._drugs = ((rd && rd.data) || []).sort((a, b) => a.name.localeCompare(b.name, 'th'));
    this._locs = ((rl && rl.data) || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const def = this._locs.find(l => l.is_default_receive) || this._locs[0];
    this.defaultLocId = def ? def.id : '';
    this.paint();
    this.loadRecent();
  },

  paint() {
    const body = document.getElementById('rcvBody');
    body.innerHTML = this.selected ? this.formHtml() : this.pickHtml();
    if (this.selected) this.bindForm(); else this.bindPick();
  },

  /* ---------- ขั้นเลือกยา ---------- */
  pickHtml() {
    return `
      <div class="page-sub">ยิงบาร์โค้ด สแกนด้วยกล้อง หรือเลือกจากรายการ</div>
      <div class="scan-input-wrap">
        <i class="bi bi-upc-scan lead"></i>
        <input id="rScan" class="scan-input" autocomplete="off" placeholder="ยิงบาร์โค้ดเพื่อเลือกยา">
      </div>
      <button id="rCam" class="btn-ghost mt-3"><i class="bi bi-camera-fill"></i> สแกนด้วยกล้อง</button>
      <div id="rCamBox" class="cam-box"></div>
      <div class="field" style="margin-top:18px">
        <label>หรือเลือกยาจากรายการ</label>
        <input type="text" id="rSearch" placeholder="ค้นหาชื่อยา">
      </div>
      <div id="rDrugList"></div>
      ${this.recentSection()}`;
  },

  bindPick() {
    const scan = document.getElementById('rScan');
    Scanner.bindInput(scan, (code) => this.onScan(code));
    setTimeout(() => scan.focus(), 200);

    document.getElementById('rCam').addEventListener('click', async (e) => {
      const b = e.currentTarget;
      if (Scanner.isCameraOpen()) { await Scanner.stopCamera(); b.innerHTML = '<i class="bi bi-camera-fill"></i> สแกนด้วยกล้อง'; return; }
      try {
        b.innerHTML = '<i class="bi bi-x-lg"></i> ปิดกล้อง';
        await Scanner.startCamera('rCamBox', async (code) => {
          await Scanner.stopCamera();
          b.innerHTML = '<i class="bi bi-camera-fill"></i> สแกนด้วยกล้อง';
          this.onScan(code);
        });
      } catch (err) { b.innerHTML = '<i class="bi bi-camera-fill"></i> สแกนด้วยกล้อง'; App.toast(err.message || 'เปิดกล้องไม่ได้', 'err'); }
    });

    const search = document.getElementById('rSearch');
    search.addEventListener('input', () => this.renderDrugOptions(search.value));
    this.renderDrugOptions('');
  },

  renderDrugOptions(q) {
    const wrap = document.getElementById('rDrugList');
    if (!this._drugs.length) { wrap.innerHTML = '<div class="hint">ยังไม่มีรายการยา เพิ่มในเมนู ตั้งค่า > รายการยา</div>'; return; }
    q = (q || '').trim().toLowerCase();
    const list = this._drugs.filter(d => !q || d.name.toLowerCase().includes(q) || (d.code || '').toLowerCase().includes(q)).slice(0, 12);
    wrap.innerHTML = list.length ? list.map(d => `
      <button class="menu-item" data-id="${d.id}">
        ${drugThumb(d.image_url)}
        <div class="mi-body"><div class="mi-title">${App.esc(d.name)}</div>
          <div class="mi-desc">${d.code ? App.esc(d.code) + ' · ' : ''}${App.esc(d.unit || 'หน่วย')}${d.require_lot ? ' · <span style="color:var(--brand-strong)">Lot บังคับ</span>' : ''}</div></div>
        <i class="bi bi-chevron-right mi-arrow"></i>
      </button>`).join('') : '<div class="hint">ไม่พบรายการที่ค้นหา</div>';
    wrap.querySelectorAll('.menu-item').forEach(b => b.addEventListener('click', () => this.select(b.dataset.id)));
  },

  async onScan(code) {
    let d = this._drugs.find(x => x.code && x.code === code);
    if (!d) { const r = await api('findDrugByCode', { code }).catch(() => null); if (r && r.drug) d = r.drug; }
    if (d) { this.select(d.id, d); App.toast('เลือก: ' + d.name, 'ok'); }
    else {
      App.toast('ไม่พบยาบาร์โค้ด ' + code + ' เพิ่มในรายการยาก่อน', 'err');
      const s = document.getElementById('rSearch'); if (s) { s.value = code; this.renderDrugOptions(code); }
    }
  },

  select(id, drugObj) {
    Scanner.stopCamera();
    this.selected = drugObj || this._drugs.find(d => d.id === id);
    this.paint();
  },

  /* ---------- ขั้นกรอกฟอร์ม ---------- */
  formHtml() {
    const d = this.selected;
    const locOpts = this._locs.map(l => `<option value="${l.id}" ${l.id === this.defaultLocId ? 'selected' : ''}>${App.esc(l.name)}</option>`).join('');
    return `
      <div class="card-soft" style="padding:14px 16px;margin-bottom:18px;display:flex;align-items:center;gap:12px">
        ${drugThumb(d.image_url)}
        <div class="flex-fill" style="min-width:0">
          <div style="font-weight:600">${App.esc(d.name)}</div>
          <div class="hint" style="margin:2px 0 0">${d.code ? App.esc(d.code) + ' · ' : ''}${App.esc(d.unit || 'หน่วย')}</div>
        </div>
        <button class="btn-ghost" style="width:auto" id="rChange">เปลี่ยน</button>
      </div>

      <div class="field"><label>Lot No. ${d.require_lot ? '<span style="color:var(--danger)">*</span>' : '<span class="hint" style="display:inline;margin:0">(ไม่บังคับ)</span>'}</label>
        <input type="text" id="rLot" autocomplete="off" placeholder="${d.require_lot ? 'จำเป็นต้องกรอก' : 'เลขล็อต (ถ้ามี)'}"></div>

      <div class="field"><label>วันหมดอายุ <span style="color:var(--danger)">*</span></label>
        <input type="date" id="rExp"></div>

      <div class="field"><label>จำนวน <span style="color:var(--danger)">*</span></label>
        <div class="qty-row">
          <button type="button" class="qty-btn" id="rMinus">-</button>
          <input type="number" id="rQty" value="1" min="1" inputmode="numeric">
          <span class="qty-unit">${App.esc(d.unit || 'หน่วย')}</span>
          <button type="button" class="qty-btn" id="rPlus">+</button>
        </div></div>

      <div class="field"><label>สถานที่เก็บ</label>
        <select id="rLoc">${locOpts}</select></div>

      <button id="rSave" class="btn-brand"><i class="bi bi-box-arrow-in-down"></i> บันทึกรับเข้า</button>
      ${this.recentSection()}`;
  },

  bindForm() {
    document.getElementById('rChange').addEventListener('click', () => {
      this.selected = null; this.paint();
      setTimeout(() => { const s = document.getElementById('rScan'); if (s) s.focus(); }, 150);
    });
    const lot = document.getElementById('rLot');
    Scanner.bindInput(lot, (c) => { lot.value = c; }, { clear: false });
    document.getElementById('rMinus').addEventListener('click', () => { const q = document.getElementById('rQty'); q.value = Math.max(1, (parseInt(q.value) || 1) - 1); });
    document.getElementById('rPlus').addEventListener('click', () => { const q = document.getElementById('rQty'); q.value = (parseInt(q.value) || 0) + 1; });
    document.getElementById('rSave').addEventListener('click', (e) => this.save(e.currentTarget));
  },

  async save(btn) {
    const d = this.selected;
    const lot = document.getElementById('rLot').value.trim();
    const exp = document.getElementById('rExp').value;
    const qty = parseInt(document.getElementById('rQty').value) || 0;
    const loc = document.getElementById('rLoc').value;
    if (d.require_lot && !lot) { App.invalid('rLot', 'ยานี้ต้องระบุ Lot No.'); return; }
    if (!exp) { App.invalid('rExp', 'กรุณาเลือกวันหมดอายุ'); return; }
    if (qty <= 0) { App.invalid('rQty', 'จำนวนต้องมากกว่า 0'); return; }
    if (!loc) { App.invalid('rLoc', 'กรุณาเลือกสถานที่'); return; }

    btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
    const r = await api('receiveItem', { drug_id: d.id, lot_no: lot, expiry_date: exp, qty, location_id: loc }).catch(() => null);
    btn.disabled = false; btn.innerHTML = '<i class="bi bi-box-arrow-in-down"></i> บันทึกรับเข้า';
    if (r && r.status === 'success') {
      App.toast(r.message, 'ok');
      if (navigator.vibrate) navigator.vibrate(40);
      this.selected = null;
      this.render(this._view); // โหลดใหม่ + รีเฟรชรับเข้าล่าสุด
    } else App.toast((r && r.message) || 'บันทึกไม่สำเร็จ', 'err');
  },

  /* ---------- รับเข้าล่าสุด ---------- */
  recentSection() {
    const today = todayLocal();
    return `<div class="d-flex justify-content-between align-items-center" style="margin:22px 4px 12px">
        <div class="section-label" style="margin:0">รับเข้าล่าสุด</div>
        <button class="link-btn" onclick="Export.run('receive','${today}','${today}',this)"><i class="bi bi-download"></i> ส่งออกวันนี้</button>
      </div>
      <div id="rRecent">${this._recent.length ? this.recentHtml() : '<div class="hint">ยังไม่มีรายการ</div>'}</div>`;
  },

  recentHtml() {
    return this._recent.map(t => {
      const days = daysToExpiry(t.expiry_date);
      const b = expiryBucket(days);
      const unit = (this._drugs.find(d => d.id === t.drug_id) || {}).unit || '';
      return `<div class="scan-row">
        ${drugThumb(t.image_url)}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600">${App.esc(t.drug_name)}</div>
          <div class="hint" style="margin:2px 0 0">+${t.qty} ${App.esc(unit)} · ${App.esc(t.to_location_name || '')}${t.lot_no ? ' · Lot ' + App.esc(t.lot_no) : ''}</div>
        </div>
        <div style="text-align:right">
          <span class="chip ${b.cls}">${b.label}</span>
          <div class="hint" style="margin:3px 0 0">${fmtDate(t.expiry_date)}</div>
        </div></div>`;
    }).join('');
  },

  async loadRecent() {
    const r = await api('recentReceives', { limit: 15 }).catch(() => null);
    this._recent = (r && r.data) || [];
    const wrap = document.getElementById('rRecent');
    if (wrap) wrap.innerHTML = this._recent.length ? this.recentHtml() : '<div class="hint">ยังไม่มีรายการ</div>';
  }
};

function viewReceive(view) { Receive.render(view); }
