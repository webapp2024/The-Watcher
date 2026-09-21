/* dashboard.js - หน้าหลัก: แผนประจำปีงบประมาณ + สรุปวงเงินที่ซื้อไปและคงเหลือ แยกตามประเภท */
const Dashboard = {
  _view: null, _data: null, _sort: 'order',

  async render(view) {
    this._view = view;
    view.innerHTML = `
      <div class="page-head">
        <div>
          <div class="page-title" style="margin-bottom:2px">${App.esc(App.fyTitle())}</div>
          <div class="page-sub" style="margin:0">ภาพรวมวงเงินที่ขออนุมัติซื้อไปแล้ว และวงเงินคงเหลือ</div>
        </div>
        ${App.yearPill('dashYear')}
      </div>
      <div id="dashBody">${App.loader()}</div>`;

    App.bindYearPill('dashYear', () => this.render(view));
    await this.load();
  },

  async load() {
    const box = document.getElementById('dashBody');
    const r = await api('getDashboard', { fiscal_year: App.fiscalYear }).catch(() => null);
    if (!r || r.status !== 'success') {
      box.innerHTML = '<div class="hint">โหลดข้อมูลไม่ได้ ตรวจการเชื่อมต่อแล้วลองใหม่</div>';
      return;
    }
    this._data = r;
    if (r.years && r.years.length) Master.years = r.years;
    this.paint();
  },

  paint() {
    const d = this._data;
    const t = d.total;
    const box = document.getElementById('dashBody');

    if (!t.items) {
      box.innerHTML = `
        ${this.statCards(t)}
        ${emptyState('ยังไม่มีรายการในแผนปีงบนี้',
          App.isAdmin() ? 'ไปที่เมนู "แผนประจำปี" เพื่อบันทึกรายการที่ได้รับอนุมัติตามแผน' : 'รอผู้ดูแลระบบบันทึกแผนประจำปี',
          'bi-journal-text')}`;
      return;
    }

    box.innerHTML = `
      ${this.statCards(t)}

      <div class="card-soft prog-card">
        <div class="d-flex justify-content-between align-items-center" style="margin-bottom:8px">
          <div style="font-weight:600">ใช้วงเงินไปแล้ว</div>
          <div class="num" style="font-weight:700;color:var(--brand-strong)">${money(t.pct, 1)}%</div>
        </div>
        ${progressBar(t.pct)}
        <div class="hint" style="margin-top:8px">
          ${money(t.used_amount)} จาก ${money(t.amount_plan)} บาท · ขออนุมัติซื้อ ${qty(t.purchase_count)} ครั้ง
        </div>
      </div>

      ${t.over_items ? `<div class="warn-banner"><i class="bi bi-exclamation-triangle-fill"></i>
        <span>มี ${t.over_items} รายการที่ขอซื้อเกินแผน</span></div>` : ''}

      <div class="d-flex justify-content-between align-items-center" style="margin:22px 4px 12px">
        <div class="section-label" style="margin:0">แยกตามประเภทแผน</div>
        <button class="link-btn" id="dashSort">${this._sort === 'order' ? 'เรียงตามวงเงิน' : 'เรียงตามลำดับ'}</button>
      </div>
      <div id="catList">${this.catRows()}</div>

      ${this.recentHtml()}

      ${App.isAdmin() ? `<button class="btn-ghost" id="goReport" style="width:100%;margin-top:22px">
        <i class="bi bi-file-earmark-text-fill"></i> ดูรายงานกำกับการจัดซื้อ</button>` : ''}`;

    const sortBtn = document.getElementById('dashSort');
    if (sortBtn) sortBtn.addEventListener('click', () => {
      this._sort = this._sort === 'order' ? 'amount' : 'order';
      this.paint();
    });

    const rep = document.getElementById('goReport');
    if (rep) rep.addEventListener('click', () => App.navigate('report'));

    document.querySelectorAll('#catList [data-cat]').forEach(el => el.addEventListener('click', () => {
      Result.pendingCategory = el.dataset.cat;
      App.navigate('result');
    }));
  },

  statCards(t) {
    const cards = [
      { c: 'safe', icon: 'bi-journal-check',  label: 'วงเงินตามแผน', v: moneyShort(t.amount_plan), sub: t.items + ' รายการ' },
      { c: 'crit', icon: 'bi-cart-check-fill', label: 'ขออนุมัติซื้อแล้ว', v: moneyShort(t.used_amount), sub: t.purchase_count + ' ครั้ง' },
      { c: 'med',  icon: 'bi-wallet2',        label: 'วงเงินคงเหลือ', v: moneyShort(t.remain_amount), sub: money(100 - t.pct, 1) + '% ของแผน' },
      { c: 'high', icon: 'bi-percent',        label: 'ใช้ไปแล้ว', v: money(t.pct, 1) + '%', sub: 'ของวงเงินตามแผน' }
    ];
    return `<div class="stat-grid">${cards.map(c => `
      <div class="stat-card ${c.c}">
        <i class="bi ${c.icon} stat-ic"></i>
        <div class="stat-num" style="font-size:1.55rem">${c.v}</div>
        <div class="stat-label">${c.label}</div>
        <div class="stat-sub">${App.esc(c.sub)}</div>
      </div>`).join('')}</div>`;
  },

  catRows() {
    let list = this._data.by_category.filter(c => c.items > 0 || c.amount_plan > 0);
    if (!list.length) return '<div class="hint">ยังไม่มีข้อมูลในประเภทใด</div>';
    if (this._sort === 'amount') list = list.slice().sort((a, b) => b.amount_plan - a.amount_plan);

    return list.map(c => `
      <button class="cat-row" data-cat="${c.id}">
        <div class="cr-top">
          <div class="mi-icon" style="background:${hexToSoft(c.color)};color:${c.color}"><i class="bi ${iconClass(c.icon)}"></i></div>
          <div style="flex:1;min-width:0">
            <div class="cr-name">${App.esc(c.name)}</div>
            <div class="cr-meta">${c.items} รายการ · ขอซื้อ ${c.purchase_count} ครั้ง</div>
          </div>
          <div style="text-align:right;flex:none">
            <div class="num cr-remain ${c.remain_amount < 0 ? 'is-over' : ''}">${money(c.remain_amount)}</div>
            <div class="cr-meta">คงเหลือ</div>
          </div>
        </div>
        ${progressBar(c.pct, c.color)}
        <div class="cr-foot">
          <span>แผน ${money(c.amount_plan)}</span>
          <span>ซื้อแล้ว ${money(c.used_amount)} (${money(c.pct, 1)}%)</span>
        </div>
      </button>`).join('');
  },

  recentHtml() {
    const list = this._data.recent || [];
    if (!list.length) return '';
    return `
      <div class="section-label">ขออนุมัติซื้อล่าสุด</div>
      ${list.map(r => `
        <div class="scan-row">
          <div class="mi-icon c-coral" style="width:38px;height:38px;font-size:16px"><i class="bi bi-cart-check-fill"></i></div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600">${App.esc(r.name)}</div>
            <div class="hint" style="margin:2px 0 0">${App.esc(r.code)} · ${qty(r.qty)} ${App.esc(r.unit || '')} · ${App.esc(r.vendor || '-')}</div>
          </div>
          <div style="text-align:right;flex:none">
            <div class="num" style="font-weight:700;color:var(--brand-strong)">${money(r.amount)}</div>
            <div class="hint" style="margin:2px 0 0">${fmtDate(r.date)}</div>
          </div>
        </div>`).join('')}`;
  }
};

function viewHome(view) { Dashboard.render(view); }
