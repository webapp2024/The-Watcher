/* result.js - ผลตามแผน: แสดง 3 ส่วน (แผน / ผลตามแผน / คงเหลือ) */
const Result = {
  _view: null, _rows: [], _total: null, _cat: '', _q: '',
  pendingCategory: null,

  async render(view) {
    this._view = view;
    if (this.pendingCategory) { this._cat = this.pendingCategory; this.pendingCategory = null; }

    view.innerHTML = `
      <div class="page-head">
        <div>
          <div class="page-title" style="margin-bottom:2px">ผลตามแผน</div>
          <div class="page-sub" style="margin:0">เทียบแผน · ผลที่ขอซื้อ · คงเหลือ · ปีงบประมาณ ${App.esc(App.fyText())}</div>
        </div>
        ${App.yearPill('resYear')}
      </div>

      <div class="field">
        <label>เลือกแผน</label>
        <select id="rsCat">${Master.catOptions(this._cat, 'ทุกประเภทแผน')}</select>
      </div>

      <div class="search-wrap" style="margin-top:0">
        <i class="bi bi-search"></i>
        <input id="rsSearch" autocomplete="off" placeholder="ค้นหารหัส หรือ ชื่อรายการ">
      </div>

      <div id="rsSummary"></div>
      <div class="d-flex justify-content-between align-items-center" style="margin:22px 4px 12px">
        <div class="section-label" style="margin:0">รายการตามแผน</div>
        <button class="link-btn" id="rsExport"><i class="bi bi-file-earmark-excel"></i> ส่งออก</button>
      </div>
      <div id="rsList">${App.loader()}</div>`;

    App.bindYearPill('resYear', () => this.render(view));
    document.getElementById('rsCat').addEventListener('change', e => { this._cat = e.target.value; this.load(); });
    document.getElementById('rsExport').addEventListener('click', () => Report.exportXlsx('result', App.fiscalYear, this._cat));

    const si = document.getElementById('rsSearch');
    let t = null;
    si.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { this._q = si.value.trim().toLowerCase(); this.paint(); }, 250);
    });

    await this.load();
  },

  async load() {
    const box = document.getElementById('rsList');
    box.innerHTML = App.loader();
    const r = await api('getPlanResult', { fiscal_year: App.fiscalYear, category_id: this._cat }).catch(() => null);
    if (!r || r.status !== 'success') { box.innerHTML = '<div class="hint">โหลดข้อมูลไม่ได้</div>'; return; }
    this._rows = r.data || [];
    this._total = r.total;
    this.paint();
  },

  paint() {
    const box = document.getElementById('rsList');
    const sum = document.getElementById('rsSummary');
    const t = this._total;

    sum.innerHTML = t && t.items ? `
      <div class="card-soft prog-card" style="margin-top:16px">
        <div class="d-flex justify-content-between align-items-center" style="margin-bottom:8px">
          <div style="font-weight:600">${this._cat ? App.esc(Master.catName(this._cat)) : 'ทุกประเภทแผน'}</div>
          <div class="num" style="font-weight:700;color:var(--brand-strong)">${money(t.pct, 1)}%</div>
        </div>
        ${progressBar(t.pct)}
        ${triStat(t.amount_plan, t.used_amount, t.remain_amount)}
      </div>` : '';

    const q = this._q;
    const list = !q ? this._rows : this._rows.filter(x =>
      String(x.code).toLowerCase().indexOf(q) !== -1 || String(x.name).toLowerCase().indexOf(q) !== -1);

    box.innerHTML = list.length
      ? list.map(it => this.row(it)).join('')
      : emptyState('ไม่มีรายการ', 'ยังไม่มีรายการในแผนของปีงบนี้', 'bi-bar-chart-line');

    box.querySelectorAll('[data-open]').forEach(b =>
      b.addEventListener('click', () => this.detail(b.dataset.open)));
  },

  row(it) {
    const over = it.remain_amount < 0 || it.remain_qty < 0;
    return `<button class="menu-item" data-open="${it.id}">
      <div class="mi-icon" style="background:${hexToSoft(it.category_color)};color:${it.category_color}">
        <i class="bi ${iconClass(it.category_icon)}"></i></div>
      <div class="mi-body">
        <div class="mi-title">${App.esc(it.name)}</div>
        <div class="mi-desc">${App.esc(it.code)} · คงเหลือ ${qty(it.remain_qty)} ${App.esc(it.unit || '')} · ${money(it.remain_amount)} บาท</div>
        ${progressBar(it.pct, it.category_color)}
      </div>
      ${over ? '<span class="chip chip-crit">เกิน</span>' : `<span class="chip chip-safe">${money(it.pct, 0)}%</span>`}
    </button>`;
  },

  async detail(id) {
    const it = this._rows.find(x => x.id === id);
    if (!it) return;
    const over = it.remain_amount < 0 || it.remain_qty < 0;

    const body = App.openSheet('ผลตามแผน', `
      <div class="rs-sec">
        <div class="rs-sec-head"><span class="rs-num">1</span> แผน</div>
        <div class="rs-kv"><span>แผน</span><b>${App.esc(it.category_name)}</b></div>
        <div class="rs-kv"><span>รหัสรายการ</span><b class="num">${App.esc(it.code)}</b></div>
        <div class="rs-kv"><span>ชื่อ</span><b>${App.esc(it.name)}</b></div>
        <div class="rs-kv"><span>หน่วยนับ</span><b>${App.esc(it.unit || '-')}</b></div>
        <div class="rs-kv"><span>จำนวนที่ได้รับอนุมัติตามแผน</span><b class="num">${qty(it.qty_plan)} ${App.esc(it.unit || '')}</b></div>
        <div class="rs-kv"><span>วงเงินที่ได้รับอนุมัติตามแผน</span><b class="num">${money(it.amount_plan)}</b></div>
      </div>

      <div class="rs-sec">
        <div class="rs-sec-head"><span class="rs-num">2</span> ผลตามแผน</div>
        <div class="rs-kv"><span>จำนวนที่ขอซื้อทั้งหมด</span><b class="num">${qty(it.used_qty)} ${App.esc(it.unit || '')}</b></div>
        <div class="rs-kv"><span>วงเงินที่ขอซื้อทั้งหมด</span><b class="num">${money(it.used_amount)}</b></div>
        <div class="rs-kv"><span>จำนวนครั้งที่ขอซื้อ</span><b class="num">${qty(it.purchase_count)} ครั้ง</b></div>
        ${progressBar(it.pct, it.category_color)}
      </div>

      <div class="rs-sec ${over ? 'rs-over' : ''}">
        <div class="rs-sec-head"><span class="rs-num">3</span> คงเหลือ</div>
        <div class="rs-kv"><span>จำนวนที่เหลือ</span><b class="num ${over ? 'is-over' : 'is-remain'}">${qty(it.remain_qty)} ${App.esc(it.unit || '')}</b></div>
        <div class="rs-kv"><span>วงเงินที่เหลือ</span><b class="num ${over ? 'is-over' : 'is-remain'}">${money(it.remain_amount)}</b></div>
      </div>

      <div class="section-label" style="margin:18px 0 10px">ประวัติการขออนุมัติซื้อ</div>
      <div id="rsHist">${App.loader()}</div>`);

    const r = await api('getPurchases', { fiscal_year: App.fiscalYear, plan_id: it.id, limit: 100 }).catch(() => null);
    const list = (r && r.data) || [];
    body.querySelector('#rsHist').innerHTML = list.length ? list.map(p => `
      <div class="scan-row">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:.92rem">${qty(p.qty)} ${App.esc(p.unit || '')} × ${money(p.unit_price)}</div>
          <div class="hint" style="margin:2px 0 0">${fmtDate(p.date)} · ${App.esc(p.vendor || '-')}${p.doc_no ? ' · ' + App.esc(p.doc_no) : ''}</div>
        </div>
        <div class="num" style="font-weight:700;color:var(--brand-strong);flex:none">${money(p.amount)}</div>
      </div>`).join('') : '<div class="hint">ยังไม่มีการขออนุมัติซื้อรายการนี้</div>';
  }
};

function viewResult(view) { Result.render(view); }
