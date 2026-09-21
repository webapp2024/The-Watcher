/* plan.js - แผนประจำปี: บันทึกรายการที่ได้รับอนุมัติตามแผน (จำนวน + วงเงิน) */
const Plan = {
  _view: null, _rows: [], _total: null, _filterCat: '', _q: '', _timer: null, _editing: null,

  async render(view) {
    this._view = view;
    this._editing = null;

    view.innerHTML = `
      <div class="page-head">
        <div>
          <div class="page-title" style="margin-bottom:2px">แผนประจำปี</div>
          <div class="page-sub" style="margin:0">ใส่รายการแผนที่ได้รับอนุมัติ · ปีงบประมาณ ${App.esc(App.fyText())}</div>
        </div>
        ${App.yearPill('planYear')}
      </div>

      <div class="card-soft form-card" id="planForm">
        <div class="form-head"><i class="bi bi-journal-plus"></i><span id="plFormTitle">เพิ่มรายการในแผน</span></div>

        <div class="field">
          <label>ประเภท <span class="req">*</span></label>
          <select id="plCat">${Master.catOptions('')}</select>
        </div>

        ${ProductLookup.fieldsHtml('pl', {})}

        <div class="field">
          <label>จำนวนที่ได้รับอนุมัติตามแผน <span class="req">*</span></label>
          <input type="number" id="plQty" inputmode="decimal" min="0" step="any" placeholder="เช่น 500">
        </div>

        <div class="field">
          <label>วงเงินที่ได้รับอนุมัติตามแผน (บาท) <span class="req">*</span></label>
          <input type="number" id="plAmt" inputmode="decimal" min="0" step="any" placeholder="เช่น 4000">
          <div class="hint" id="plUnitPrice"></div>
        </div>

        <div class="field">
          <label>หมายเหตุ</label>
          <input type="text" id="plNote" autocomplete="off" placeholder="ถ้ามี">
        </div>

        <button class="btn-brand" id="plSave"><i class="bi bi-check2"></i> บันทึกเข้าแผน</button>
        <button class="btn-ghost" id="plCancel" style="width:100%;margin-top:10px;display:none">ยกเลิกการแก้ไข</button>
      </div>

      <div class="d-flex justify-content-between align-items-center" style="margin:26px 4px 12px">
        <div class="section-label" style="margin:0">รายการในแผนปีนี้</div>
        <button class="link-btn" id="plExport"><i class="bi bi-file-earmark-excel"></i> ส่งออก</button>
      </div>

      <div class="field" style="margin-bottom:10px">
        <select id="plFilterCat">${Master.catOptions(this._filterCat, 'ทุกประเภทแผน')}</select>
      </div>
      <div class="search-wrap" style="margin-top:0">
        <i class="bi bi-search"></i>
        <input id="plSearch" autocomplete="off" placeholder="ค้นหารหัส หรือ ชื่อรายการ">
      </div>

      <div id="plTotals"></div>
      <div id="plList" style="margin-top:14px">${App.loader()}</div>`;

    App.bindYearPill('planYear', () => this.render(view));
    ProductLookup.bind('pl');

    document.getElementById('plSave').addEventListener('click', e => this.save(e));
    document.getElementById('plCancel').addEventListener('click', () => this.resetForm());
    document.getElementById('plExport').addEventListener('click', () => Report.exportXlsx('plan', App.fiscalYear, this._filterCat));

    ['plQty', 'plAmt'].forEach(id =>
      document.getElementById(id).addEventListener('input', () => this.showUnitPrice()));

    document.getElementById('plFilterCat').addEventListener('change', e => {
      this._filterCat = e.target.value; this.load();
    });
    const si = document.getElementById('plSearch');
    si.addEventListener('input', () => {
      clearTimeout(this._timer);
      this._timer = setTimeout(() => { this._q = si.value.trim(); this.load(); }, 300);
    });

    await this.load();
  },

  showUnitPrice() {
    const q = numVal('plQty'), a = numVal('plAmt');
    const el = document.getElementById('plUnitPrice');
    el.textContent = (q > 0 && a > 0) ? 'เฉลี่ยหน่วยละ ' + money(a / q) + ' บาท' : '';
  },

  async load() {
    const box = document.getElementById('plList');
    if (!box) return;
    box.innerHTML = App.loader();
    const r = await api('getPlanItems', {
      fiscal_year: App.fiscalYear, category_id: this._filterCat, q: this._q
    }).catch(() => null);

    if (!r || r.status !== 'success') { box.innerHTML = '<div class="hint">โหลดข้อมูลไม่ได้</div>'; return; }
    this._rows = r.data || [];
    this._total = r.total;

    document.getElementById('plTotals').innerHTML = this._rows.length
      ? triStat(r.total.amount_plan, r.total.used_amount, r.total.remain_amount) : '';

    box.innerHTML = this._rows.length
      ? this._rows.map(it => this.row(it)).join('')
      : emptyState(this._q || this._filterCat ? 'ไม่พบรายการ' : 'ยังไม่มีรายการในแผนปีนี้',
          this._q || this._filterCat ? 'ลองเปลี่ยนคำค้นหรือประเภท' : 'กรอกแบบฟอร์มด้านบนเพื่อเพิ่มรายการแรก', 'bi-journal-text');

    box.querySelectorAll('[data-edit]').forEach(b =>
      b.addEventListener('click', () => this.edit(b.dataset.edit)));
    box.querySelectorAll('[data-del]').forEach(b =>
      b.addEventListener('click', () => this.remove(b.dataset.del)));
  },

  row(it) {
    const over = it.remain_amount < 0 || it.remain_qty < 0;
    return `<div class="card-soft plan-card">
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div style="flex:1;min-width:0">
          <div class="pc-name">${App.esc(it.name)}</div>
          <div class="pc-code">${App.esc(it.code)} · ${App.esc(it.unit || '-')}</div>
          <span class="cat-tag" style="background:${hexToSoft(it.category_color)};color:${it.category_color};margin-top:6px">${App.esc(it.category_name)}</span>
        </div>
        ${over ? '<span class="chip chip-crit">เกินแผน</span>' : `<span class="chip chip-safe">${money(it.pct, 0)}%</span>`}
      </div>
      ${progressBar(it.pct, it.category_color)}
      <div class="pc-grid">
        <div><span>ตามแผน</span><b class="num">${qty(it.qty_plan)}</b><i class="num">${money(it.amount_plan)}</i></div>
        <div><span>ขอซื้อแล้ว</span><b class="num">${qty(it.used_qty)}</b><i class="num">${money(it.used_amount)}</i></div>
        <div><span>คงเหลือ</span><b class="num ${over ? 'is-over' : 'is-remain'}">${qty(it.remain_qty)}</b><i class="num ${over ? 'is-over' : ''}">${money(it.remain_amount)}</i></div>
      </div>
      ${it.note ? `<div class="hint" style="margin-top:6px">${App.esc(it.note)}</div>` : ''}
      <div class="d-flex gap-2 mt-2">
        <button class="btn-ghost btn-mini" data-edit="${it.id}"><i class="bi bi-pencil"></i> แก้ไข</button>
        <button class="btn-ghost btn-mini btn-danger-ghost" data-del="${it.id}"><i class="bi bi-trash"></i> ลบ</button>
      </div>
    </div>`;
  },

  edit(id) {
    const it = this._rows.find(x => x.id === id);
    if (!it) return;
    this._editing = it;
    document.getElementById('plFormTitle').textContent = 'แก้ไขรายการในแผน';
    document.getElementById('plCat').value = it.category_id;
    ProductLookup.fill('pl', it);
    document.getElementById('plQty').value = it.qty_plan;
    document.getElementById('plAmt').value = it.amount_plan;
    document.getElementById('plNote').value = it.note || '';
    document.getElementById('plSave').innerHTML = '<i class="bi bi-check2"></i> บันทึกการแก้ไข';
    document.getElementById('plCancel').style.display = '';
    document.getElementById('plCodeHint').innerHTML =
      `<span class="ok-hint"><i class="bi bi-info-circle-fill"></i> ขอซื้อไปแล้ว ${qty(it.used_qty)} ${App.esc(it.unit || '')} · ${money(it.used_amount)} บาท</span>`;
    this.showUnitPrice();
    document.getElementById('planForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  resetForm() {
    this._editing = null;
    document.getElementById('plFormTitle').textContent = 'เพิ่มรายการในแผน';
    document.getElementById('plCode').value = '';
    document.getElementById('plName').value = '';
    document.getElementById('plUnit').value = '';
    document.getElementById('plQty').value = '';
    document.getElementById('plAmt').value = '';
    document.getElementById('plNote').value = '';
    document.getElementById('plUnitPrice').textContent = '';
    document.getElementById('plCodeHint').textContent = 'ใส่รหัสแล้วกดออกจากช่อง ระบบจะดึงชื่อและหน่วยนับให้อัตโนมัติ';
    document.getElementById('plSave').innerHTML = '<i class="bi bi-check2"></i> บันทึกเข้าแผน';
    document.getElementById('plCancel').style.display = 'none';
  },

  async save(e) {
    const catId = document.getElementById('plCat').value;
    const v = ProductLookup.values('pl');
    const qtyPlan = numVal('plQty');
    const amtPlan = numVal('plAmt');

    if (!catId) { App.invalid('plCat', 'กรุณาเลือกประเภทแผน'); return; }
    if (!v.code.trim()) { App.invalid('plCode', 'กรุณากรอกรหัสรายการ'); return; }
    if (!v.name.trim()) { App.invalid('plName', 'กรุณากรอกชื่อรายการ'); return; }
    if (!v.unit) { App.invalid('plUnit', 'กรุณาเลือกหน่วยนับ'); return; }
    if (qtyPlan <= 0) { App.invalid('plQty', 'กรอกจำนวนที่ได้รับอนุมัติตามแผน'); return; }
    if (amtPlan <= 0) { App.invalid('plAmt', 'กรอกวงเงินที่ได้รับอนุมัติตามแผน'); return; }

    const btn = e.currentTarget;
    const html = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';

    const item = {
      id: this._editing ? this._editing.id : '',
      fiscal_year: App.fiscalYear,
      category_id: catId,
      code: v.code.trim(), name: v.name.trim(), unit: v.unit,
      qty_plan: qtyPlan, amount_plan: amtPlan,
      note: document.getElementById('plNote').value.trim()
    };

    const r = await api('savePlanItem', { item, fiscal_year: App.fiscalYear }).catch(() => null);
    btn.disabled = false; btn.innerHTML = html;

    if (r && r.status === 'success') {
      App.toast(r.message, 'ok');
      this.resetForm();
      await Master.load(true);
      this.load();
      return;
    }

    if (r && r.code === 'DUP' && r.dup_id) {
      const ok = await App.confirm('รหัสนี้มีในแผนแล้ว', r.message + ' ต้องการเปิดรายการเดิมเพื่อแก้ไขหรือไม่', 'เปิดรายการเดิม');
      if (ok) {
        await this.load();
        this.edit(r.dup_id);
      }
      return;
    }
    App.toast((r && r.message) || 'บันทึกไม่สำเร็จ', 'err');
  },

  async remove(id) {
    const it = this._rows.find(x => x.id === id);
    if (!it) return;
    const ok = await App.confirm('ลบรายการในแผน', 'ลบ "' + it.name + '" ออกจากแผนปีนี้ใช่หรือไม่', 'ลบ');
    if (!ok) return;
    const r = await api('deletePlanItem', { id }).catch(() => null);
    if (r && r.status === 'success') { App.toast(r.message, 'ok'); this.load(); }
    else App.toast((r && r.message) || 'ลบไม่สำเร็จ', 'err');
  }
};

function viewPlan(view) { Plan.render(view); }
