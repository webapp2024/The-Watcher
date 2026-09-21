/* issue.js - ใบเบิก: ออกใบเบิกหลายรายการต่อใบ (FIFO ใกล้หมดอายุก่อน) + พิมพ์ฟอร์มราชการ */
const Issue = {
  _view: null, _recent: [], cart: [], _timer: null,

  async render(view) {
    this._view = view;
    view.innerHTML = `<div class="page-title">ใบเบิก</div><div id="isBody">${App.loader()}</div>`;
    const rx = await api('recentIssues', { limit: 30 }).catch(() => null);
    this._recent = (rx && rx.data) || [];
    this.paint();
  },

  paint() {
    document.getElementById('isBody').innerHTML = `
      <div class="page-sub">ค้นหายาแล้วแตะเพื่อเพิ่มเข้าใบเบิก เพิ่มได้หลายรายการต่อใบ · ระบบหักจาก Lot ที่ใกล้หมดอายุก่อนให้อัตโนมัติ</div>

      <div class="search-wrap">
        <i class="bi bi-search"></i>
        <input id="isSearch" autocomplete="off" placeholder="ค้นหาชื่อยา หรือรหัสยา">
      </div>
      <div id="isList" class="is-results"></div>

      <div class="section-label" style="display:flex;align-items:center">รายการที่จะเบิก<span id="isCount" class="count-pill" style="display:none">0</span></div>
      <div id="isCart"></div>

      <div id="isForm" style="display:none">
        <div class="section-label">ข้อมูลผู้เบิก</div>
        <div class="card-soft" style="padding:16px 16px 4px">
          <div class="field"><label>ผู้เบิก <span style="color:var(--danger)">*</span></label>
            <input type="text" id="isRequester" autocomplete="off" placeholder="ชื่อ-สกุล ผู้เบิก"></div>
          <div class="d-flex gap-2">
            <div class="field flex-fill"><label>ตำแหน่ง</label>
              <input type="text" id="isPosition" autocomplete="off" placeholder="ตำแหน่ง"></div>
            <div class="field flex-fill"><label>หน่วยงาน / ฝ่าย</label>
              <input type="text" id="isDept" autocomplete="off" placeholder="เช่น OPD"></div>
          </div>
          <div class="field"><label>ผู้รับแทน (ถ้ามี)</label>
            <input type="text" id="isReceiver" autocomplete="off" placeholder="ผู้รับแทนข้าพเจ้า"></div>
          <div class="field" style="margin-bottom:14px"><label>หมายเหตุ (ถ้ามี)</label>
            <input type="text" id="isNote" autocomplete="off"></div>
        </div>
        <button id="isConfirm" class="btn-brand" style="margin-top:16px"><i class="bi bi-file-earmark-text"></i> ออกใบเบิก & พิมพ์</button>
      </div>

      <div class="section-label">เบิกล่าสุด</div>
      <div id="isRecent">${this._recent.length ? this.recentHtml() : '<div class="hint">ยังไม่มีรายการ</div>'}</div>

      <div class="section-label" style="margin-top:28px">ค้นหาประวัติใบเบิก</div>
      <div class="card-soft" style="padding:14px 16px">
        <div class="search-wrap" style="margin-bottom:8px">
          <i class="bi bi-search"></i>
          <input id="isHistQ" autocomplete="off" placeholder="เลขที่ใบเบิก, ชื่อผู้เบิก, หน่วยงาน">
        </div>
        <div class="d-flex gap-2 align-items-center">
          <input type="date" id="isHistFrom" class="date-inp flex-fill">
          <span style="color:var(--muted);flex:none">ถึง</span>
          <input type="date" id="isHistTo" class="date-inp flex-fill">
          <button id="isHistBtn" class="btn-ghost" style="width:auto;padding:10px 14px;flex:none"><i class="bi bi-search"></i></button>
        </div>
      </div>
      <div id="isHistResults"></div>`;

    const input = document.getElementById('isSearch');
    input.addEventListener('input', () => {
      const q = input.value.trim();
      clearTimeout(this._timer);
      if (!q) { document.getElementById('isList').innerHTML = ''; return; }
      this._timer = setTimeout(() => this.search(q), 300);
    });

    document.getElementById('isConfirm').addEventListener('click', (e) => this.confirm(e.currentTarget));
    this.bindRecent();
    this.renderCart();

    const histBtn = document.getElementById('isHistBtn');
    const histQ   = document.getElementById('isHistQ');
    if (histBtn) histBtn.addEventListener('click', () => this.searchHistory());
    if (histQ)   histQ.addEventListener('keydown', e => { if (e.key === 'Enter') this.searchHistory(); });
  },

  async search(q) {
    const wrap = document.getElementById('isList');
    if (!wrap) return;
    wrap.innerHTML = '<div class="hint" style="padding:4px 4px 0">กำลังค้นหา...</div>';
    const r = await api('issueSearch', { q }).catch(() => null);
    const list = (r && r.data) || [];
    if (!list.length) { wrap.innerHTML = '<div class="hint" style="padding:4px 4px 0">ไม่พบยาที่มีของในคลัง</div>'; return; }
    wrap.innerHTML = list.map(d => {
      const b = expiryBucket(d.min_days);
      const inCart = this.cart.some(x => x.drug_id === d.drug_id);
      return `<button class="menu-item is-pick ${inCart ? 'added' : ''}" data-id="${d.drug_id}" ${inCart ? 'disabled' : ''}>
        ${drugThumb(d.image_url)}
        <div class="mi-body"><div class="mi-title">${App.esc(d.drug_name)}</div>
          <div class="mi-desc">คงเหลือ <b>${d.total}</b>${d.unit ? ' ' + App.esc(d.unit) : ''} · ${d.lots} Lot</div></div>
        <span class="chip ${b.cls}">${b.label}</span>
        <i class="bi ${inCart ? 'bi-check-circle-fill' : 'bi-plus-circle-fill'} is-add-ic"></i>
      </button>`;
    }).join('');
    wrap.querySelectorAll('.is-pick').forEach(btn => btn.addEventListener('click', () => {
      const d = list.find(x => x.drug_id === btn.dataset.id);
      this.addToCart(d);
      document.getElementById('isSearch').value = '';
      wrap.innerHTML = '';
      if (navigator.vibrate) navigator.vibrate(15);
    }));
  },

  addToCart(d) {
    if (this.cart.some(x => x.drug_id === d.drug_id)) return;
    this.cart.push({
      drug_id: d.drug_id, drug_name: d.drug_name, unit: d.unit || '',
      price: d.price || 0,
      total: d.total, min_days: d.min_days, image_url: d.image_url || '', qty: 1, note: ''
    });
    this.renderCart();
  },

  renderCart() {
    const wrap = document.getElementById('isCart');
    const form = document.getElementById('isForm');
    const count = document.getElementById('isCount');
    const confirm = document.getElementById('isConfirm');
    if (!wrap) return;

    if (count) { count.textContent = this.cart.length; count.style.display = this.cart.length ? 'inline-grid' : 'none'; }

    if (!this.cart.length) {
      wrap.innerHTML = `<div class="cart-empty">
        <i class="bi bi-clipboard-plus"></i>
        <div>ยังไม่มีรายการ — ค้นหาด้านบนแล้วแตะยาเพื่อเพิ่ม</div></div>`;
      if (form) form.style.display = 'none';
      return;
    }
    if (form) form.style.display = 'block';

    const totalQty = this.cart.reduce((s, it) => s + (it.qty || 0), 0);
    const totalValue = this.cart.reduce((s, it) => s + (it.price || 0) * (it.qty || 0), 0);
    const fmtBaht = n => '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    wrap.innerHTML = this.cart.map(it => {
      const b = expiryBucket(it.min_days);
      const lineValue = (it.price || 0) * it.qty;
      return `
      <div class="cart-item card-soft">
        <div class="ci-top">
          ${drugThumb(it.image_url)}
          <div class="ci-info">
            <div class="ci-name">${App.esc(it.drug_name)}</div>
            <div class="ci-meta">คงเหลือ ${it.total}${it.unit ? ' ' + App.esc(it.unit) : ''} <span class="chip ${b.cls}">${b.label}</span></div>
          </div>
          <button class="ci-del" data-id="${it.drug_id}" aria-label="ลบ"><i class="bi bi-trash3"></i></button>
        </div>
        <div class="cart-qty">
          <span class="cq-label">จำนวนเบิก</span>
          <div class="qty-row">
            <button type="button" class="qty-btn is-minus" data-id="${it.drug_id}">-</button>
            <input type="number" class="is-qty" data-id="${it.drug_id}" value="${it.qty}" min="1" max="${it.total}" inputmode="numeric">
            <button type="button" class="qty-btn is-plus" data-id="${it.drug_id}">+</button>
            ${it.price ? `<span class="qty-unit" style="margin-left:8px;color:var(--brand-strong)">${fmtBaht(lineValue)}</span>` : ''}
          </div>
        </div>
      </div>`;
    }).join('') + `
      <div class="cart-summary"><span>รวมที่จะเบิก</span><span>${this.cart.length} รายการ · ${totalQty} หน่วย</span></div>
      ${totalValue > 0 ? `<div class="cart-summary" style="font-weight:700;color:var(--brand-strong)"><span>มูลค่ารวม</span><span>${fmtBaht(totalValue)}</span></div>` : ''}`;

    if (confirm) confirm.innerHTML = `<i class="bi bi-file-earmark-text"></i> ออกใบเบิก & พิมพ์ (${this.cart.length} รายการ)`;

    const find = id => this.cart.find(x => x.drug_id === id);
    wrap.querySelectorAll('.ci-del').forEach(b => b.addEventListener('click', () => {
      this.cart = this.cart.filter(x => x.drug_id !== b.dataset.id);
      this.renderCart();
    }));
    wrap.querySelectorAll('.is-minus').forEach(b => b.addEventListener('click', () => {
      const it = find(b.dataset.id); it.qty = Math.max(1, it.qty - 1); this.renderCart();
    }));
    wrap.querySelectorAll('.is-plus').forEach(b => b.addEventListener('click', () => {
      const it = find(b.dataset.id); it.qty = Math.min(it.total, it.qty + 1); this.renderCart();
    }));
    wrap.querySelectorAll('.is-qty').forEach(inp => inp.addEventListener('change', () => {
      const it = find(inp.dataset.id);
      let v = parseInt(inp.value) || 1;
      it.qty = Math.max(1, Math.min(it.total, v)); this.renderCart();
    }));
  },

  async confirm(btn) {
    if (!this.cart.length) { App.toast('ยังไม่ได้เลือกยา', 'err'); return; }
    const requester = document.getElementById('isRequester').value.trim();
    if (!requester) { App.invalid('isRequester', 'กรุณาระบุผู้เบิก'); return; }
    const payload = {
      requester,
      position: document.getElementById('isPosition').value.trim(),
      department: document.getElementById('isDept').value.trim(),
      receiver: document.getElementById('isReceiver').value.trim(),
      note: document.getElementById('isNote').value.trim(),
      items: this.cart.map(it => ({ drug_id: it.drug_id, qty: it.qty, note: it.note || '' }))
    };

    btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
    const r = await api('issueSlip', payload).catch(() => null);
    btn.disabled = false; btn.innerHTML = '<i class="bi bi-file-earmark-text"></i> ออกใบเบิก & พิมพ์';
    if (r && r.status === 'success') {
      App.toast(r.message, 'ok');
      if (navigator.vibrate) navigator.vibrate(40);
      this.cart = [];
      this.printSlip(r.slip_no);
      this.render(this._view);
    } else App.toast((r && r.message) || 'ออกใบเบิกไม่สำเร็จ', 'err');
  },

  /* ---------- เบิกล่าสุด (รวมเป็นใบ ตามเลขที่) ---------- */
  groupedRecent() {
    const map = {};
    const order = [];
    this._recent.forEach(t => {
      const key = t.slip_no || ('_' + t.id);
      if (!map[key]) { map[key] = { slip_no: t.slip_no || '', requester: t.requester || '', department: t.department || '', created_at: t.created_at, drugs: {} }; order.push(key); }
      map[key].drugs[t.drug_name] = (map[key].drugs[t.drug_name] || 0) + Number(t.qty || 0);
    });
    return order.map(k => map[k]);
  },

  recentHtml() {
    return this.groupedRecent().map(s => {
      const names = Object.keys(s.drugs);
      const summary = names.slice(0, 2).join(', ') + (names.length > 2 ? ' +' + (names.length - 2) : '');
      const when = s.created_at ? new Date(s.created_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      const sub = [s.requester, s.department, when].filter(Boolean).map(App.esc).join(' · ');
      return `<div class="issue-row">
        <div class="ir-ic"><i class="bi bi-box-arrow-right"></i></div>
        <div class="ir-body">
          <div class="ir-title">${s.slip_no ? 'เลขที่ ' + App.esc(s.slip_no) : 'ใบเบิก'} <span class="ir-count">${names.length} รายการ</span></div>
          <div class="ir-sub">${App.esc(summary)}</div>
          <div class="ir-sub">${sub}</div>
        </div>
        ${s.slip_no ? `<button class="ir-print is-print" data-slip="${App.esc(s.slip_no)}" aria-label="พิมพ์"><i class="bi bi-printer"></i></button>` : ''}
      </div>`;
    }).join('');
  },

  bindRecent() {
    document.querySelectorAll('#isRecent .is-print').forEach(b =>
      b.addEventListener('click', () => this.printSlip(b.dataset.slip)));
  },

  async searchHistory() {
    const q    = (document.getElementById('isHistQ')    || {}).value?.trim() || '';
    const from = (document.getElementById('isHistFrom') || {}).value || '';
    const to   = (document.getElementById('isHistTo')   || {}).value || '';
    const wrap = document.getElementById('isHistResults');
    if (!q && !from && !to) { App.toast('กรอกคำค้นหา หรือเลือกช่วงวันที่', 'err'); return; }
    wrap.innerHTML = App.loader();
    const r = await api('searchIssueSlips', { q, date_from: from, date_to: to, limit: 100 }).catch(() => null);
    const slips = (r && r.data) || [];
    if (!slips.length) { wrap.innerHTML = '<div class="hint" style="padding:10px 4px">ไม่พบใบเบิกที่ตรงกัน</div>'; return; }
    wrap.innerHTML = slips.map(s => {
      const names = s.drugs.slice(0, 2).map(d => App.esc(d.drug_name)).join(', ')
        + (s.drugs.length > 2 ? ` +${s.drugs.length - 2}` : '');
      const when = s.created_at
        ? new Date(s.created_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
        : '';
      const sub = [s.requester, s.department, when].filter(Boolean).map(App.esc).join(' · ');
      return `<div class="issue-row">
        <div class="ir-ic"><i class="bi bi-box-arrow-right"></i></div>
        <div class="ir-body">
          <div class="ir-title">${s.slip_no ? 'เลขที่ ' + App.esc(s.slip_no) : 'ใบเบิก'} <span class="ir-count">${s.drug_count} รายการ</span></div>
          <div class="ir-sub">${names}</div>
          <div class="ir-sub">${sub}</div>
        </div>
        ${s.slip_no ? `<button class="ir-print is-hist-print" data-slip="${App.esc(s.slip_no)}" aria-label="พิมพ์"><i class="bi bi-printer"></i></button>` : ''}
      </div>`;
    }).join('');
    wrap.querySelectorAll('.is-hist-print').forEach(b =>
      b.addEventListener('click', () => this.printSlip(b.dataset.slip)));
  },

  /* ---------- พิมพ์ใบเบิก (ฟอร์ม A4) ---------- */
  async printSlip(slipNo) {
    App.showLoading('กำลังเตรียมใบเบิก');
    const r = await api('getIssueSlip', { slip_no: slipNo }).catch(() => null);
    App.hideLoading();
    if (!r || r.status !== 'success') { App.toast((r && r.message) || 'เปิดใบเบิกไม่สำเร็จ', 'err'); return; }
    this.renderPrint(r.slip, r.form || {}, r.hospital_name || (App.branding && App.branding.hospital_name) || '');
  },

  renderPrint(slip, form, hospital) {
    const esc = App.esc;
    const dot = (w) => `<span style="display:inline-block;border-bottom:1px dotted #000;min-width:${w}"></span>`;
    const lines = slip.lines || [];
    const MIN_ROWS = 12;
    const dateStr = slip.date ? new Date(slip.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

    const hasPrice = lines.some(l => l.unit_price > 0);
    const fmtNum = n => (n == null || n === '') ? '' : Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    let grandTotal = 0;

    let rows = lines.map((l, i) => {
      const lineTotal = hasPrice ? (l.unit_price || 0) * (l.issued || 0) : 0;
      grandTotal += lineTotal;
      return `<tr>
        <td class="c">${i + 1}</td>
        <td>${esc(l.drug_name)}</td>
        <td class="c">${l.max_qty || ''}</td>
        <td class="c">${l.min_qty || ''}</td>
        <td class="c">${l.remaining}</td>
        <td class="c">${esc(l.unit || '')}</td>
        <td class="c">${l.issued}</td>
        <td class="c"></td>
        ${hasPrice ? `<td class="r">${l.unit_price ? fmtNum(l.unit_price) : ''}</td><td class="r">${lineTotal ? fmtNum(lineTotal) : ''}</td>` : ''}
        <td>${esc(l.note || '')}</td>
      </tr>`;
    }).join('');
    for (let i = lines.length; i < MIN_ROWS; i++) {
      rows += `<tr><td class="c">${i + 1}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>${hasPrice ? '<td></td><td></td>' : ''}<td></td></tr>`;
    }
    if (hasPrice && grandTotal > 0) {
      rows += `<tr><td colspan="9" style="text-align:right;font-weight:600;border-top:2px solid #000">รวมมูลค่า</td><td class="r" style="font-weight:600">${fmtNum(grandTotal)}</td><td></td></tr>`;
    }

    const sigBlock = (role, name, position) => `
      <div class="sig">
        <div>ลงชื่อ${dot('150px')}${role}</div>
        <div class="ct">( ${name ? esc(name) : dot('150px')} )</div>
        <div class="ct">ตำแหน่ง ${position ? esc(position).replace(/\n/g, '<br>') : dot('150px')}</div>
      </div>`;

    const title = form.title || 'ใบเบิกเวชภัณฑ์ยาและเวชภัณฑ์มิใช่ยา';
    const orgUnit = form.org_unit || (hospital ? 'งานคลังเวชภัณฑ์' + hospital : 'งานคลังเวชภัณฑ์');
    const fromUnit = form.from_unit || hospital || '';

    const w = window.open('', '_blank');
    if (!w) { App.toast('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต popup', 'err'); return; }
    w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบเบิก ${esc(slip.slip_no)}</title>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600&display=swap" rel="stylesheet">
      <style>
        @page { size:A4; margin:14mm; }
        * { box-sizing:border-box; }
        body { font-family:'Sarabun',sans-serif; color:#000; font-size:14px; }
        .center { text-align:center; }
        h1 { font-size:16px; margin:0; }
        h2 { font-size:14px; font-weight:600; margin:2px 0 12px; }
        .head-row { display:flex; justify-content:space-between; gap:16px; margin:6px 0; }
        .mt { margin-top:10px; line-height:2; }
        table { width:100%; border-collapse:collapse; font-size:13px; margin-top:8px; }
        th,td { border:1px solid #000; padding:3px 5px; vertical-align:top; }
        th { text-align:center; font-weight:600; }
        td.c { text-align:center; }
        td.r { text-align:right; }
        .sigs { display:flex; flex-wrap:wrap; margin-top:22px; }
        .sig { width:50%; line-height:2.1; margin-bottom:14px; }
        .sig .ct { text-align:center; padding-right:40px; }
      </style></head><body>
      <div class="center"><h1>${esc(title)}</h1><h2>${esc(orgUnit)}</h2></div>
      <div class="head-row">
        <div>จากหน่วยงาน ${esc(fromUnit) || dot('200px')}</div>
        <div>ใบเบิกเลขที่ ${esc(slip.slip_no)}</div>
      </div>
      <div>ถึง ${esc(form.to_label || 'หัวหน้าหน่วยพัสดุ')}</div>
      <div class="mt">
        ข้าพเจ้า ${slip.requester ? esc(slip.requester) : dot('220px')} ตำแหน่ง ${slip.position ? esc(slip.position) : dot('220px')}<br>
        ขอเบิกพัสดุเพื่อใช้ในงาน/ฝ่าย ${slip.department ? esc(slip.department) : dot('180px')} และมอบให้ ${slip.receiver ? esc(slip.receiver) : dot('180px')} เป็นผู้รับแทนข้าพเจ้า
      </div>
      <table>
        <thead>
          <tr>
            <th rowspan="2">ลำดับ</th><th rowspan="2">รายการ</th>
            <th>จำนวน</th><th>จำนวน</th><th rowspan="2">คงเหลือ</th><th rowspan="2">หน่วยนับ</th>
            <th colspan="2">จำนวน</th>
            ${hasPrice ? '<th rowspan="2">ราคา/หน่วย</th><th rowspan="2">รวมเงิน</th>' : ''}
            <th rowspan="2">หมายเหตุ</th>
          </tr>
          <tr><th>สูงสุด</th><th>ต่ำสุด</th><th>เบิก</th><th>จ่าย</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="sigs">
        ${sigBlock('ผู้เบิก', '', '')}
        ${sigBlock('ผู้จ่าย', form.issuer_name, form.issuer_position)}
        ${sigBlock('ผู้สั่งจ่าย', form.approver_name, form.approver_position)}
        ${sigBlock('ผู้รับ', '', '')}
      </div>
      <div class="center" style="margin-top:6px;font-size:12px;color:#444">วันที่เบิก ${esc(dateStr)}</div>
      <script>window.onload=function(){setTimeout(function(){window.print();},400);}<\/script>
      </body></html>`);
    w.document.close();
  }
};

function viewIssue(view) { Issue.render(view); }
