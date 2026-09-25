/* purchase.js - ขออนุมัติซื้อ: ใส่รายการที่จะขอซื้อตามแผน (ตัดจำนวน/วงเงินออกจากแผน) */
const Purchase = {
  _view: null, _rows: [], _plan: null, _filterCat: '', _q: '', _timer: null, _editing: null,

  async render(view) {
    this._view = view;
    this._plan = null;
    this._editing = null;

    view.innerHTML = `
      <div class="page-head">
        <div>
          <div class="page-title" style="margin-bottom:2px">ขออนุมัติซื้อ</div>
          <div class="page-sub" style="margin:0">รายการที่จะขอซื้อตามแผน · ปีงบประมาณ ${App.esc(App.fyText())}</div>
        </div>
        ${App.yearPill('purYear')}
      </div>

      <div class="card-soft form-card" id="purForm">
        <div class="form-head"><i class="bi bi-cart-check-fill"></i><span id="purFormTitle">เพิ่มรายการขออนุมัติซื้อ</span></div>

        <div class="field">
          <label>ประเภท <span class="req">*</span></label>
          <select id="puCat">${Master.catOptions('')}</select>
        </div>

        ${ProductLookup.fieldsHtml('pu', {}, { readonly: true })}

        <div id="puPlanBox"></div>

        <div class="field">
          <label>จำนวนที่ขอซื้อ <span class="req">*</span></label>
          <input type="number" id="puQty" inputmode="decimal" min="0" step="any" placeholder="เช่น 100">
        </div>

        <div class="field">
          <label>ราคาต่อหน่วย (รวมภาษี) <span class="req">*</span></label>
          <input type="number" id="puPrice" inputmode="decimal" min="0" step="any" placeholder="เช่น 800">
        </div>

        <div class="field">
          <label>วงเงินที่ขอซื้อ (บาท) <span class="req">*</span></label>
          <input type="number" id="puAmt" inputmode="decimal" min="0" step="any" placeholder="คำนวณอัตโนมัติ">
          <div class="hint" id="puAmtHint">คิดจาก จำนวน × ราคาต่อหน่วย · แก้เองได้</div>
        </div>

        <div class="field">
          <label>ผู้ขาย <span class="req">*</span></label>
          <input type="text" id="puVendor" autocomplete="off" placeholder="เช่น GPO">
        </div>

        <div class="field">
          <label>เลขที่เอกสาร / วันที่สั่งซื้อ</label>
          <div class="d-flex gap-2">
            <input type="text" id="puDoc" autocomplete="off" placeholder="เลขที่เอกสาร" style="flex:1">
            <input type="date" id="puDate" class="date-inp" style="flex:none">
          </div>
        </div>

        <button class="btn-brand" id="puSave"><i class="bi bi-check2"></i> บันทึกขออนุมัติซื้อ</button>
        <button class="btn-ghost" id="puCancel" style="width:100%;margin-top:10px;display:none">ยกเลิกการแก้ไข</button>
      </div>

      <div class="d-flex justify-content-between align-items-center" style="margin:26px 4px 12px">
        <div class="section-label" style="margin:0">รายการที่ขออนุมัติซื้อแล้ว</div>
        <button class="link-btn" id="puExport"><i class="bi bi-file-earmark-excel"></i> ส่งออก</button>
      </div>

      <div class="field" style="margin-bottom:10px">
        <select id="puFilterCat">${Master.catOptions(this._filterCat, 'ทุกประเภทแผน')}</select>
      </div>
      <div class="search-wrap" style="margin-top:0">
        <i class="bi bi-search"></i>
        <input id="puSearch" autocomplete="off" placeholder="ค้นหารหัส ชื่อรายการ หรือ ผู้ขาย">
      </div>

      <div id="puTotals"></div>
      <div id="puList" style="margin-top:14px">${App.loader()}</div>`;

    App.bindYearPill('purYear', () => this.render(view));
    document.getElementById('puDate').value = todayLocal();

    ProductLookup.bind('pu', () => this.refreshPlan());
    document.getElementById('puCat').addEventListener('change', () => this.refreshPlan());

    document.getElementById('puQty').addEventListener('input', () => this.calcAmount());
    document.getElementById('puPrice').addEventListener('input', () => this.calcAmount());
    document.getElementById('puAmt').addEventListener('input', () => { this._amtTouched = true; this.checkRemain(); });

    document.getElementById('puSave').addEventListener('click', e => this.save(e));
    document.getElementById('puCancel').addEventListener('click', () => this.resetForm());
    document.getElementById('puExport').addEventListener('click', () => Report.exportXlsx('purchase', App.fiscalYear, this._filterCat));

    document.getElementById('puFilterCat').addEventListener('change', e => {
      this._filterCat = e.target.value; this.load();
    });
    const si = document.getElementById('puSearch');
    si.addEventListener('input', () => {
      clearTimeout(this._timer);
      this._timer = setTimeout(() => { this._q = si.value.trim(); this.load(); }, 300);
    });

    await this.load();
  },

  /* ---------- ดึงรายการในแผนของรหัสที่กรอก ---------- */
  async refreshPlan() {
    const catId = document.getElementById('puCat').value;
    const code = (document.getElementById('puCode').value || '').trim();
    const box = document.getElementById('puPlanBox');
    this._plan = null;

    if (!catId || !code) { box.innerHTML = ''; this.checkRemain(); return; }

    box.innerHTML = '<div class="hint" style="margin:0 0 14px">กำลังตรวจสอบยอดคงเหลือตามแผน...</div>';
    const r = await api('getPlanItems', { fiscal_year: App.fiscalYear, category_id: catId, q: code }).catch(() => null);
    const list = (r && r.data) || [];
    const hit = list.find(x => String(x.code).toUpperCase() === code.toUpperCase());

    if (!hit) {
      box.innerHTML = `<div class="warn-banner" style="margin:0 0 16px">
        <i class="bi bi-exclamation-triangle-fill"></i>
        <span>ไม่พบรหัส ${App.esc(code)} ในแผนประเภทนี้ของปีงบ ${App.fiscalYear}${App.isAdmin() ? ' — บันทึกในหน้าแผนประจำปีก่อน' : ''}</span>
      </div>`;
      this.checkRemain();
      return;
    }

    this._plan = hit;
    // ชื่อและหน่วยนับยึดตามแผนเสมอ
    ProductLookup.fill('pu', hit);

    const over = hit.remain_amount < 0 || hit.remain_qty < 0;
    box.innerHTML = `
      <div class="plan-box ${over ? 'is-over' : ''}">
        <div class="pb-head"><i class="bi bi-journal-check"></i> ยอดตามแผนของรายการนี้</div>
        <div class="pc-grid">
          <div><span>ตามแผน</span><b class="num">${qty(hit.qty_plan)} ${App.esc(hit.unit || '')}</b><i class="num">${money(hit.amount_plan)}</i></div>
          <div><span>ขอซื้อแล้ว</span><b class="num">${qty(hit.used_qty)} ${App.esc(hit.unit || '')}</b><i class="num">${money(hit.used_amount)}</i></div>
          <div><span>คงเหลือ</span><b class="num ${over ? 'is-over' : 'is-remain'}">${qty(hit.remain_qty)} ${App.esc(hit.unit || '')}</b><i class="num ${over ? 'is-over' : ''}">${money(hit.remain_amount)}</i></div>
        </div>
        ${progressBar(hit.pct, hit.category_color)}
      </div>`;
    this.checkRemain();
  },

  calcAmount() {
    const q = numVal('puQty'), p = numVal('puPrice');
    const amt = document.getElementById('puAmt');
    if (!this._amtTouched && q > 0 && p > 0) amt.value = Math.round(q * p * 100) / 100;
    this.checkRemain();
  },

  /* เตือนล่วงหน้าถ้าเกินยอดคงเหลือตามแผน */
  checkRemain() {
    const hint = document.getElementById('puAmtHint');
    if (!hint) return;
    const p = this._plan;
    if (!p) { hint.textContent = 'คิดจาก จำนวน × ราคาต่อหน่วย · แก้เองได้'; hint.className = 'hint'; return; }

    const editUsedQty = this._editing ? this._editing.qty : 0;
    const editUsedAmt = this._editing ? this._editing.amount : 0;
    const remainQty = p.remain_qty + editUsedQty;
    const remainAmt = p.remain_amount + editUsedAmt;

    const q = numVal('puQty'), a = numVal('puAmt');
    const msgs = [];
    if (q > remainQty) msgs.push('จำนวนเกินแผน (เหลือ ' + qty(remainQty) + ')');
    if (a > remainAmt) msgs.push('วงเงินเกินแผน (เหลือ ' + money(remainAmt) + ')');

    if (msgs.length) {
      hint.className = 'hint hint-err';
      hint.innerHTML = '<i class="bi bi-exclamation-triangle-fill"></i> ' + msgs.join(' · ');
    } else {
      hint.className = 'hint';
      hint.textContent = 'คงเหลือตามแผน ' + qty(remainQty) + ' ' + (p.unit || '') + ' · ' + money(remainAmt) + ' บาท';
    }
  },

  async load() {
    const box = document.getElementById('puList');
    if (!box) return;
    box.innerHTML = App.loader();
    const r = await api('getPurchases', {
      fiscal_year: App.fiscalYear, category_id: this._filterCat, q: this._q, limit: 200
    }).catch(() => null);

    if (!r || r.status !== 'success') { box.innerHTML = '<div class="hint">โหลดข้อมูลไม่ได้</div>'; return; }
    this._rows = r.data || [];

    document.getElementById('puTotals').innerHTML = this._rows.length ? `
      <div class="value-banner" style="margin-top:14px">
        <div>
          <div class="hint" style="margin:0 0 4px">รวมวงเงินที่ขอซื้อ (${r.total.count} รายการ)</div>
          <div style="font-size:1.35rem;font-weight:700;color:var(--brand-strong);line-height:1.1" class="num">${money(r.total.amount)}</div>
        </div>
        <i class="bi bi-cash-stack" style="font-size:1.9rem;opacity:.4"></i>
      </div>` : '';

    box.innerHTML = this._rows.length
      ? this._rows.map(it => this.row(it)).join('')
      : emptyState(this._q || this._filterCat ? 'ไม่พบรายการ' : 'ยังไม่มีการขออนุมัติซื้อ',
          'กรอกแบบฟอร์มด้านบนเพื่อบันทึกรายการแรก', 'bi-cart');

    box.querySelectorAll('[data-edit]').forEach(b =>
      b.addEventListener('click', () => this.edit(b.dataset.edit)));
    box.querySelectorAll('[data-del]').forEach(b =>
      b.addEventListener('click', () => this.remove(b.dataset.del)));
  },

  row(it) {
    const canEdit = App.isAdmin() || it.by === (App.user && App.user.username);
    return `<div class="card-soft plan-card">
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div style="flex:1;min-width:0">
          <div class="pc-name">${App.esc(it.name)}</div>
          <div class="pc-code">${App.esc(it.code)} · ${qty(it.qty)} ${App.esc(it.unit || '')} × ${money(it.unit_price)}</div>
          <span class="cat-tag" style="background:${hexToSoft(it.category_color)};color:${it.category_color};margin-top:6px">${App.esc(it.category_name)}</span>
          ${it.over_plan ? '<span class="chip chip-crit" style="margin-left:6px">เกินแผน</span>' : ''}
        </div>
        <div style="text-align:right;flex:none">
          <div class="num" style="font-weight:700;font-size:1.05rem;color:var(--brand-strong)">${money(it.amount)}</div>
          <div class="hint" style="margin:2px 0 0">${fmtDate(it.date)}</div>
        </div>
      </div>
      <div class="hint" style="margin-top:8px">
        <i class="bi bi-shop"></i> ${App.esc(it.vendor || '-')}${it.doc_no ? ' · เลขที่ ' + App.esc(it.doc_no) : ''} · โดย ${App.esc(it.by || '-')}
      </div>
      ${canEdit ? `<div class="d-flex gap-2 mt-2">
        <button class="btn-ghost btn-mini" data-edit="${it.id}"><i class="bi bi-pencil"></i> แก้ไข</button>
        ${App.isAdmin() ? `<button class="btn-ghost btn-mini btn-danger-ghost" data-del="${it.id}"><i class="bi bi-trash"></i> ลบ</button>` : ''}
      </div>` : ''}
    </div>`;
  },

  async edit(id) {
    const it = this._rows.find(x => x.id === id);
    if (!it) return;
    this._editing = it;
    this._amtTouched = true;
    document.getElementById('purFormTitle').textContent = 'แก้ไขรายการขออนุมัติซื้อ';
    document.getElementById('puCat').value = it.category_id;
    ProductLookup.fill('pu', it);
    document.getElementById('puQty').value = it.qty;
    document.getElementById('puPrice').value = it.unit_price;
    document.getElementById('puAmt').value = it.amount;
    document.getElementById('puVendor').value = it.vendor || '';
    document.getElementById('puDoc').value = it.doc_no || '';
    document.getElementById('puDate').value = (it.date || todayLocal()).slice(0, 10);
    document.getElementById('puSave').innerHTML = '<i class="bi bi-check2"></i> บันทึกการแก้ไข';
    document.getElementById('puCancel').style.display = '';
    document.getElementById('purForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    await this.refreshPlan();
  },

  resetForm() {
    this._editing = null;
    this._plan = null;
    this._amtTouched = false;
    document.getElementById('purFormTitle').textContent = 'เพิ่มรายการขออนุมัติซื้อ';
    ['puCode', 'puName', 'puQty', 'puPrice', 'puAmt', 'puVendor', 'puDoc'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('puUnit').value = '';
    document.getElementById('puDate').value = todayLocal();
    document.getElementById('puPlanBox').innerHTML = '';
    document.getElementById('puCodeHint').textContent = 'ใส่รหัสแล้วกดออกจากช่อง ระบบจะดึงชื่อและหน่วยนับให้อัตโนมัติ';
    document.getElementById('puSave').innerHTML = '<i class="bi bi-check2"></i> บันทึกขออนุมัติซื้อ';
    document.getElementById('puCancel').style.display = 'none';
    this.checkRemain();
  },

  async save(e) {
    const catId = document.getElementById('puCat').value;
    const v = ProductLookup.values('pu');
    const q = numVal('puQty');
    const price = numVal('puPrice');
    const amt = numVal('puAmt') || Math.round(q * price * 100) / 100;
    const vendor = document.getElementById('puVendor').value.trim();

    if (!catId) { App.invalid('puCat', 'กรุณาเลือกประเภทแผน'); return; }
    if (!v.code.trim()) { App.invalid('puCode', 'กรุณากรอกรหัสรายการ'); return; }
    if (q <= 0) { App.invalid('puQty', 'กรอกจำนวนที่ขอซื้อ'); return; }
    if (price <= 0) { App.invalid('puPrice', 'กรอกราคาต่อหน่วย'); return; }
    if (amt <= 0) { App.invalid('puAmt', 'กรอกวงเงินที่ขอซื้อ'); return; }
    if (!vendor) { App.invalid('puVendor', 'กรุณากรอกชื่อผู้ขาย'); return; }

    const item = {
      id: this._editing ? this._editing.id : '',
      fiscal_year: App.fiscalYear,
      category_id: catId,
      code: v.code.trim(),
      qty: q, unit_price: price, amount: amt,
      vendor,
      doc_no: document.getElementById('puDoc').value.trim(),
      date: document.getElementById('puDate').value || todayLocal()
    };

    await this.submit(item, false, e.currentTarget);
  },

  async submit(item, overOk, btn) {
    const html = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
    const r = await api('savePurchase', { item, fiscal_year: App.fiscalYear, over_ok: overOk }).catch(() => null);
    btn.disabled = false; btn.innerHTML = html;

    if (r && r.status === 'success') {
      App.toast(r.message, 'ok');
      if (r.remain_amount !== undefined) {
        App.toast('คงเหลือตามแผน ' + money(r.remain_amount) + ' บาท');
      }
      this.resetForm();
      this.load();
      return;
    }

    if (r && r.code === 'OVER') {
      if (r.can_override) {
        const ok = await App.confirm('เกินวงเงิน/จำนวนตามแผน',
          r.message + ' — ยืนยันบันทึกเกินแผนหรือไม่ (ระบบจะทำเครื่องหมายไว้ในรายงาน)', 'ยืนยันบันทึกเกินแผน');
        if (ok) await this.submit(item, true, btn);
      } else {
        App.toast(r.message + ' · ขอซื้อเกินแผนไม่ได้', 'err');
      }
      return;
    }

    App.toast((r && r.message) || 'บันทึกไม่สำเร็จ', 'err');
  },

  async remove(id) {
    const it = this._rows.find(x => x.id === id);
    if (!it) return;
    const ok = await App.confirm('ลบรายการขออนุมัติซื้อ',
      'ลบ "' + it.name + '" จำนวน ' + qty(it.qty) + ' ' + (it.unit || '') + ' ใช่หรือไม่ ยอดจะถูกคืนเข้าแผน', 'ลบ');
    if (!ok) return;
    const r = await api('deletePurchase', { id }).catch(() => null);
    if (r && r.status === 'success') { App.toast(r.message, 'ok'); this.load(); this.refreshPlan(); }
    else App.toast((r && r.message) || 'ลบไม่สำเร็จ', 'err');
  }
};

function viewPurchase(view) { Purchase.render(view); }
