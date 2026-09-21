/* report.js - รายงานกำกับติดตามการจัดซื้อ: สรุปตามแผน · รายงานขออนุมัติซื้อรายวัน/ช่วงวัน + ส่งออก Excel + พิมพ์ */
const Report = {
  _view: null, _mode: 'plan', _cat: '', _data: null,
  _from: '', _to: '', _preset: 'fy',

  async render(view) {
    this._view = view;
    const isBuy = this._mode === 'purchase';

    view.innerHTML = `
      <div class="page-head">
        <div>
          <div class="page-title" style="margin-bottom:2px">รายงาน</div>
          <div class="page-sub" style="margin:0">กำกับติดตามการจัดซื้อไม่ให้เกินแผน · ปีงบประมาณ ${App.esc(App.fyText())}</div>
        </div>
        ${App.yearPill('repYear')}
      </div>

      <div class="hist-filter">
        <button class="hchip ${isBuy ? '' : 'on'}" data-m="plan">สรุปตามแผน</button>
        <button class="hchip ${isBuy ? 'on' : ''}" data-m="purchase">รายงานขออนุมัติซื้อ</button>
      </div>

      ${isBuy ? this.dateFilterHtml() : ''}

      <div class="field">
        <label>ประเภทแผน</label>
        <select id="rpCat">${Master.catOptions(this._cat, 'ทุกประเภทแผน')}</select>
      </div>

      <div class="d-flex gap-2" style="margin-bottom:18px">
        <button class="btn-ghost" id="rpXlsx" style="flex:1"><i class="bi bi-file-earmark-excel"></i> ส่งออก Excel</button>
        <button class="btn-brand" id="rpPrint" style="flex:1"><i class="bi bi-printer"></i> พิมพ์ / PDF</button>
      </div>

      <div id="rpBody">${App.loader()}</div>`;

    App.bindYearPill('repYear', () => this.render(view));
    view.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => {
      this._mode = b.dataset.m; this.render(view);
    }));
    document.getElementById('rpCat').addEventListener('change', e => { this._cat = e.target.value; this.load(); });
    document.getElementById('rpXlsx').addEventListener('click', () =>
      this.exportXlsx(isBuy ? 'purchase' : 'result', App.fiscalYear, this._cat, this._from, this._to));
    document.getElementById('rpPrint').addEventListener('click', () => this.print());

    if (isBuy) this.bindDateFilter();
    await this.load();
  },

  /* ---------------- ตัวกรองช่วงวันที่ (เฉพาะรายงานขออนุมัติซื้อ) ---------------- */
  dateFilterHtml() {
    const presets = [
      { k: 'today', t: 'วันนี้' },
      { k: 'yesterday', t: 'เมื่อวาน' },
      { k: '7d', t: '7 วันล่าสุด' },
      { k: 'month', t: 'เดือนนี้' },
      { k: 'fy', t: 'ทั้งปีงบ' }
    ];
    return `
      <div class="hist-filter" id="rpPresets">
        ${presets.map(p => `<button class="hchip ${this._preset === p.k ? 'on' : ''}" data-p="${p.k}">${p.t}</button>`).join('')}
      </div>
      <div class="field">
        <label>ช่วงวันที่ขอซื้อ</label>
        <div class="date-range">
          <input type="date" id="rpFrom" class="date-inp" value="${this._from}">
          <span>ถึง</span>
          <input type="date" id="rpTo" class="date-inp" value="${this._to}">
        </div>
        <div class="hint" id="rpRangeHint">${this._from || this._to
          ? App.esc(fmtRange(this._from, this._to))
          : 'ไม่ระบุช่วงวัน = ดูทั้งปีงบประมาณ ' + App.esc(App.fyText())}</div>
      </div>`;
  },

  bindDateFilter() {
    const today = todayLocal();
    const firstOfMonth = today.slice(0, 8) + '01';
    const map = {
      today: [today, today],
      yesterday: [addDays(today, -1), addDays(today, -1)],
      '7d': [addDays(today, -6), today],
      month: [firstOfMonth, today],
      fy: ['', '']
    };

    document.querySelectorAll('#rpPresets [data-p]').forEach(b => b.addEventListener('click', () => {
      this._preset = b.dataset.p;
      const r = map[this._preset] || ['', ''];
      this._from = r[0]; this._to = r[1];
      document.getElementById('rpFrom').value = this._from;
      document.getElementById('rpTo').value = this._to;
      document.querySelectorAll('#rpPresets [data-p]').forEach(x => x.classList.toggle('on', x === b));
      this.syncRangeHint();
      this.load();
    }));

    ['rpFrom', 'rpTo'].forEach(id => document.getElementById(id).addEventListener('change', () => {
      this._from = document.getElementById('rpFrom').value;
      this._to = document.getElementById('rpTo').value;
      if (this._from && this._to && this._from > this._to) {
        App.toast('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด', 'err');
        return;
      }
      this._preset = 'custom';
      document.querySelectorAll('#rpPresets [data-p]').forEach(x => x.classList.remove('on'));
      this.syncRangeHint();
      this.load();
    }));
  },

  syncRangeHint() {
    const el = document.getElementById('rpRangeHint');
    if (!el) return;
    el.textContent = (this._from || this._to)
      ? fmtRange(this._from, this._to)
      : 'ไม่ระบุช่วงวัน = ดูทั้งปีงบประมาณ ' + App.fyText();
  },

  async load() {
    const box = document.getElementById('rpBody');
    box.innerHTML = App.loader();
    const r = await api('getReport', {
      fiscal_year: App.fiscalYear, category_id: this._cat, mode: this._mode,
      from: this._from, to: this._to
    }).catch(() => null);
    if (!r || r.status !== 'success') { box.innerHTML = '<div class="hint">โหลดข้อมูลไม่ได้</div>'; return; }
    this._data = r;
    box.innerHTML = this._mode === 'purchase' ? this.purchaseHtml(r) : this.planHtml(r);
  },

  /* ---------------- โหมดสรุปตามแผน ---------------- */
  planHtml(r) {
    if (!r.groups || !r.groups.length) return emptyState('ไม่มีข้อมูล', 'ยังไม่มีรายการในแผนของปีงบนี้', 'bi-file-earmark-text');
    const t = r.total;
    return `
      <div class="card-soft prog-card">
        <div class="d-flex justify-content-between align-items-center" style="margin-bottom:8px">
          <div style="font-weight:600">ภาพรวมทั้งหมด</div>
          <div class="num" style="font-weight:700;color:var(--brand-strong)">${money(t.pct, 1)}%</div>
        </div>
        ${progressBar(t.pct)}
        ${triStat(t.amount_plan, t.used_amount, t.remain_amount)}
      </div>

      ${r.groups.map(g => `
        <div class="rep-group">
          <div class="rep-head" style="border-left-color:${g.color}">
            <div style="flex:1;min-width:0">
              <div class="rep-title">${App.esc(g.name)}</div>
              <div class="hint" style="margin:2px 0 0">แผน ${money(g.amount_plan)} · ซื้อแล้ว ${money(g.used_amount)} · คงเหลือ ${money(g.remain_amount)}</div>
            </div>
            <div class="num rep-pct">${money(g.pct, 0)}%</div>
          </div>
          <div class="ur-table-wrap">
            <table class="ur-table">
              <thead><tr>
                <th style="width:34px">#</th><th>รหัส</th><th>รายการ</th><th>หน่วย</th>
                <th>จำนวนแผน</th><th>วงเงินแผน</th>
                <th>ซื้อแล้ว</th><th>วงเงินซื้อ</th>
                <th>คงเหลือ</th><th>วงเงินคงเหลือ</th>
              </tr></thead>
              <tbody>${g.rows.map((x, i) => {
                const over = x.remain_amount < 0 || x.remain_qty < 0;
                return `<tr class="${over ? 'row-over' : ''}">
                  <td class="urt-n">${i + 1}</td>
                  <td class="urt-c">${App.esc(x.code)}</td>
                  <td>${App.esc(x.name)}</td>
                  <td class="urt-c">${App.esc(x.unit || '-')}</td>
                  <td class="urt-c num">${qty(x.qty_plan)}</td>
                  <td class="urt-c num">${money(x.amount_plan)}</td>
                  <td class="urt-c num">${qty(x.used_qty)}</td>
                  <td class="urt-c num">${money(x.used_amount)}</td>
                  <td class="urt-c num ${over ? 'is-over' : ''}">${qty(x.remain_qty)}</td>
                  <td class="urt-c num urt-bold ${over ? 'is-over' : ''}">${money(x.remain_amount)}</td>
                </tr>`;
              }).join('')}
              <tr class="row-sum">
                <td colspan="5" class="urt-bold">รวม ${g.rows.length} รายการ</td>
                <td class="urt-c num urt-bold">${money(g.amount_plan)}</td>
                <td></td>
                <td class="urt-c num urt-bold">${money(g.used_amount)}</td>
                <td></td>
                <td class="urt-c num urt-bold">${money(g.remain_amount)}</td>
              </tr>
              </tbody>
            </table>
          </div>
        </div>`).join('')}`;
  },

  /* ---------------- โหมดรายงานขออนุมัติซื้อ ---------------- */
  periodText(r) {
    return (r.from || r.to) ? fmtRange(r.from, r.to) : 'ปีงบประมาณ พ.ศ. ' + r.fiscal_year;
  },

  purchaseHtml(r) {
    const list = r.data || [];
    const period = this.periodText(r);

    if (!list.length) {
      return emptyState('ไม่มีรายการขออนุมัติซื้อ', period, 'bi-cart');
    }

    return `
      <div class="card-soft prog-card">
        <div class="rep-period"><i class="bi bi-calendar2-check"></i> ${App.esc(period)}</div>
        <div class="tri-stat" style="margin-top:12px">
          <div><div class="ts-label">จำนวนรายการ</div><div class="ts-val num">${qty(r.total.count)}</div></div>
          <div><div class="ts-label">ประเภทแผน</div><div class="ts-val num">${qty((r.by_category || []).length)}</div></div>
          <div><div class="ts-label">รวมเป็นเงิน</div><div class="ts-val num ts-used">${money(r.total.amount)}</div></div>
        </div>
        <div class="baht-text">(${App.esc(bahtText(r.total.amount))})</div>
      </div>

      <div class="section-label">สรุปตามประเภทแผน</div>
      <div class="ur-table-wrap">
        <table class="ur-table">
          <thead><tr>
            <th style="width:34px">#</th><th>ประเภทแผน</th><th>จำนวนรายการ</th><th>รวมเป็นเงิน (บาท)</th>
          </tr></thead>
          <tbody>
            ${(r.by_category || []).map((c, i) => `
              <tr>
                <td class="urt-n">${i + 1}</td>
                <td>${App.esc(c.name)}${c.over_count ? ` <span class="chip chip-crit">เกินแผน ${c.over_count}</span>` : ''}</td>
                <td class="urt-c num">${qty(c.count)}</td>
                <td class="urt-c num urt-bold">${money(c.amount)}</td>
              </tr>`).join('')}
            <tr class="row-sum">
              <td colspan="2" class="urt-bold">รวมทั้งสิ้น</td>
              <td class="urt-c num urt-bold">${qty(r.total.count)}</td>
              <td class="urt-c num urt-bold">${money(r.total.amount)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="section-label">รายละเอียด</div>
      <div class="ur-table-wrap">
        <table class="ur-table">
          <thead><tr>
            <th style="width:34px">#</th><th>วันที่</th><th>ประเภทแผน</th><th>รหัส</th><th>รายการ</th>
            <th>จำนวน</th><th>ราคา/หน่วย</th><th>วงเงิน</th><th>ผู้ขาย</th><th>เลขที่เอกสาร</th>
          </tr></thead>
          <tbody>${list.map((x, i) => `
            <tr class="${x.over_plan ? 'row-over' : ''}">
              <td class="urt-n">${i + 1}</td>
              <td class="urt-c">${fmtDate(x.date)}</td>
              <td>${App.esc(x.category_name)}</td>
              <td class="urt-c">${App.esc(x.code)}</td>
              <td>${App.esc(x.name)}</td>
              <td class="urt-c num">${qty(x.qty)} ${App.esc(x.unit || '')}</td>
              <td class="urt-c num">${money(x.unit_price)}</td>
              <td class="urt-c num urt-bold">${money(x.amount)}</td>
              <td>${App.esc(x.vendor || '-')}</td>
              <td class="urt-c">${App.esc(x.doc_no || '-')}</td>
            </tr>`).join('')}
            <tr class="row-sum">
              <td colspan="7" class="urt-bold">รวมทั้งสิ้น ${qty(r.total.count)} รายการ</td>
              <td class="urt-c num urt-bold">${money(r.total.amount)}</td>
              <td colspan="2"></td>
            </tr>
          </tbody>
        </table>
      </div>`;
  },

  /* ---------------- ส่งออก Excel ---------------- */
  async exportXlsx(kind, fiscalYear, categoryId, from, to) {
    App.showLoading('กำลังเตรียมไฟล์');
    try {
      const r = await api('exportData', {
        kind,
        fiscal_year: fiscalYear || App.fiscalYear,
        category_id: categoryId || '',
        from: from || '', to: to || ''
      }).catch(() => null);

      if (!r || r.status !== 'success') { App.toast((r && r.message) || 'ส่งออกไม่สำเร็จ', 'err'); return; }
      if (!r.count) { App.toast('ไม่มีข้อมูลให้ส่งออก', 'err'); return; }

      const aoa = [r.columns].concat(r.rows);
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = r.columns.map((c, i) => ({ wch: i <= 1 ? 22 : Math.max(12, String(c).length + 4) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ข้อมูล');
      XLSX.writeFile(wb, r.filename);
      App.toast('ส่งออก ' + r.count + ' รายการแล้ว', 'ok');
    } finally {
      App.hideLoading();
    }
  },

  /* ---------------- พิมพ์ / บันทึก PDF ---------------- */
  print() {
    if (!this._data) { App.toast('ยังไม่มีข้อมูล', 'err'); return; }
    if (this._mode === 'purchase') { this.printPurchase(); return; }

    const body = document.getElementById('rpBody');
    const title = (this._data.hospital_name || App.branding.hospital_name || '') +
      ' · รายงานผลการจัดซื้อตามแผน ปีงบประมาณ พ.ศ. ' + this._data.fiscal_year +
      (this._cat ? ' · ' + Master.catName(this._cat) : '');
    this.openPrintWindow(title, `
      <h1>${App.esc(title)}</h1>
      <div class="sub">พิมพ์เมื่อ ${new Date().toLocaleString('th-TH')}</div>
      ${body.innerHTML}`);
  },

  /* เอกสารรายงานขออนุมัติซื้อ (จัดหน้าเอง ไม่ก๊อปจากหน้าจอ) */
  printPurchase() {
    const r = this._data;
    const list = r.data || [];
    if (!list.length) { App.toast('ไม่มีรายการในช่วงที่เลือก', 'err'); return; }

    const org = r.hospital_name || App.branding.hospital_name || '';
    const period = this.periodText(r);
    const scope = this._cat ? Master.catName(this._cat) : 'ทุกประเภทแผน';
    const title = 'รายงานการขออนุมัติซื้อ';

    const summaryRows = (r.by_category || []).map((c, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td>${App.esc(c.name)}</td>
        <td class="c">${qty(c.count)}</td>
        <td class="r b">${money(c.amount)}</td>
      </tr>`).join('');

    const detailRows = list.map((x, i) => `
      <tr class="${x.over_plan ? 'over' : ''}">
        <td class="c">${i + 1}</td>
        <td class="c">${fmtDate(x.date)}</td>
        <td>${App.esc(x.category_name)}</td>
        <td class="c">${App.esc(x.code)}</td>
        <td>${App.esc(x.name)}${x.over_plan ? ' <b>(เกินแผน)</b>' : ''}</td>
        <td class="c">${qty(x.qty)} ${App.esc(x.unit || '')}</td>
        <td class="r">${money(x.unit_price)}</td>
        <td class="r b">${money(x.amount)}</td>
        <td>${App.esc(x.vendor || '-')}</td>
        <td class="c">${App.esc(x.doc_no || '-')}</td>
      </tr>`).join('');

    this.openPrintWindow(org + ' - ' + title, `
      <div class="doc-head">
        ${App.branding.logo_url ? `<img class="doc-logo" src="${App.branding.logo_url}" alt="">` : ''}
        <div>
          <div class="doc-org">${App.esc(org)}</div>
          <h1>${App.esc(title)}</h1>
          <div class="doc-period">${App.esc(period)}</div>
          <div class="sub">ประเภทแผน: ${App.esc(scope)} · ปีงบประมาณ พ.ศ. ${r.fiscal_year}</div>
        </div>
      </div>

      <div class="sec-title">สรุปตามประเภทแผน</div>
      <table class="narrow">
        <thead><tr><th style="width:36px">ที่</th><th>ประเภทแผน</th><th style="width:100px">จำนวนรายการ</th><th style="width:150px">รวมเป็นเงิน (บาท)</th></tr></thead>
        <tbody>
          ${summaryRows}
          <tr class="sum"><td colspan="2" class="b">รวมทั้งสิ้น</td>
            <td class="c b">${qty(r.total.count)}</td>
            <td class="r b">${money(r.total.amount)}</td></tr>
        </tbody>
      </table>
      <div class="baht">(${App.esc(bahtText(r.total.amount))})</div>

      <div class="sec-title">รายละเอียดรายการที่ขออนุมัติซื้อ</div>
      <table>
        <thead><tr>
          <th style="width:32px">ที่</th><th style="width:78px">วันที่</th><th>ประเภทแผน</th>
          <th style="width:86px">รหัส</th><th>รายการ</th><th style="width:78px">จำนวน</th>
          <th style="width:82px">ราคา/หน่วย</th><th style="width:92px">วงเงิน</th>
          <th style="width:110px">ผู้ขาย</th><th style="width:86px">เลขที่เอกสาร</th>
        </tr></thead>
        <tbody>
          ${detailRows}
          <tr class="sum"><td colspan="7" class="b">รวมทั้งสิ้น ${qty(r.total.count)} รายการ</td>
            <td class="r b">${money(r.total.amount)}</td><td colspan="2"></td></tr>
        </tbody>
      </table>

      <div class="signs">
        ${['ผู้จัดทำ', 'ผู้ตรวจสอบ', 'ผู้อนุมัติ'].map(role => `
          <div>
            <div class="line"></div>
            <div class="paren">(...................................................)</div>
            <div class="role">${role}</div>
          </div>`).join('')}
      </div>
      <div class="sub" style="margin-top:14px">พิมพ์เมื่อ ${new Date().toLocaleString('th-TH')} · โดย ${App.esc((App.user && App.user.username) || '')}</div>`);
  },

  openPrintWindow(title, bodyHtml) {
    const w = window.open('', '_blank');
    if (!w) { App.toast('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต popup', 'err'); return; }
    w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8">
      <title>${App.esc(title)}</title>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body{font-family:'Sarabun',sans-serif;font-size:13px;color:#1a1a1a;margin:20px}
        h1{font-size:19px;margin:2px 0 4px}
        .doc-head{display:flex;align-items:center;gap:16px;border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:16px}
        .doc-logo{width:64px;height:64px;object-fit:contain}
        .doc-org{font-size:15px;font-weight:700}
        .doc-period{font-size:14px;font-weight:600;margin-top:2px}
        .sub{color:#666;font-size:11.5px}
        .sec-title{font-weight:700;font-size:14px;margin:18px 0 7px}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:6px}
        table.narrow{width:auto;min-width:60%}
        th{background:#ececec;border:1px solid #888;padding:6px 7px;text-align:center;font-weight:700}
        td{border:1px solid #bbb;padding:5px 7px;vertical-align:middle}
        .c{text-align:center}.r{text-align:right}.b{font-weight:700}
        tr.sum td{background:#f2f2f2;font-weight:700}
        tr.over td{background:#ffeced}
        .baht{text-align:right;font-weight:700;margin:4px 0 2px;font-size:12.5px}
        .signs{display:flex;justify-content:space-between;gap:24px;margin-top:52px;text-align:center;font-size:12px}
        .signs>div{flex:1 1 0}
        .signs .line{border-bottom:1px dotted #333;margin:0 12px 7px;height:34px}
        .signs .paren{color:#444}
        .signs .role{margin-top:4px;font-weight:600}
        /* ส่วนที่มาจากหน้าจอ (โหมดสรุปตามแผน) */
        .urt-c,.urt-n{text-align:center}.urt-bold{font-weight:700}
        .rep-title{font-weight:700;font-size:14px;margin:14px 0 6px}
        .rep-pct,.pbar,.tri-stat,.chip,button,.rep-period,.baht-text{display:none !important}
        .ur-table th{background:#ececec;color:#1a1a1a;border:1px solid #888}
        .ur-table tr.row-sum td{background:#f2f2f2;font-weight:700}
        .ur-table tr.row-over td{background:#ffeced}
        .is-over{color:#c00}
        .hint{color:#666;font-size:11px}
        .section-label{font-weight:700;font-size:14px;margin:16px 0 7px}
        @page{size:A4 landscape;margin:10mm}
        @media print{ body{margin:0} tr{page-break-inside:avoid} thead{display:table-header-group} }
      </style></head><body>${bodyHtml}</body></html>`);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 600);
  }
};

function viewReport(view) { Report.render(view); }
