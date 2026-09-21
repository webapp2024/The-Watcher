/* categories.js - ประเภทแผน: การ์ดต่อประเภท + รายการในแผนของประเภทนั้น + จัดการประเภท (admin) */

const ICON_KEYS = ['capsule', 'bandaid', 'heartpulse', 'flask', 'tooth', 'radioactive', 'cup', 'shirt',
                   'house', 'pencil', 'pc', 'tools', 'box', 'prescription', 'printer', 'people', 'cart', 'truck', 'clipboard', 'bank'];
const COLOR_SET = ['#6D3FD6', '#0EA5A5', '#E8556D', '#2563EB', '#0891B2', '#14B8A6', '#F59E0B',
                   '#D97706', '#7C3AED', '#16A34A', '#4F46E5', '#EA580C', '#64748B', '#9333EA', '#0F766E', '#DB2777'];

const Categories = {
  _view: null, _rows: [], _cur: null,

  async grid(view) {
    this._view = view; this._cur = null;
    view.innerHTML = `
      <div class="page-head">
        <div>
          <div class="page-title" style="margin-bottom:2px">แผนแต่ละประเภท</div>
          <div class="page-sub" style="margin:0">ปีงบประมาณ ${App.esc(App.fyText())} · แตะเพื่อดูรายการในแผน</div>
        </div>
        ${App.yearPill('catYear')}
      </div>
      ${App.isAdmin() ? `<button class="btn-ghost" id="manageCats" style="width:100%;margin-bottom:16px">
        <i class="bi bi-sliders"></i> จัดการประเภทแผน</button>` : ''}
      <div id="catGrid" class="loc-grid">${App.loader()}</div>`;

    App.bindYearPill('catYear', () => this.grid(view));
    const mc = document.getElementById('manageCats');
    if (mc) mc.addEventListener('click', () => this.manage());

    const r = await api('getDashboard', { fiscal_year: App.fiscalYear }).catch(() => null);
    const wrap = document.getElementById('catGrid');
    if (!r || r.status !== 'success') { wrap.innerHTML = '<div class="hint">โหลดข้อมูลไม่ได้</div>'; return; }

    this._rows = r.by_category || [];
    if (!this._rows.length) {
      wrap.classList.remove('loc-grid');
      wrap.innerHTML = emptyState('ยังไม่มีประเภทแผน', 'เพิ่มได้ที่ปุ่มจัดการประเภทแผน', 'bi-collection');
      return;
    }
    wrap.classList.add('loc-grid');
    wrap.innerHTML = this._rows.map(c => this.tile(c)).join('');
    wrap.querySelectorAll('.loc-tile').forEach(t =>
      t.addEventListener('click', () => this.detail(view, t.dataset.id)));
  },

  tile(c) {
    return `<button class="loc-tile" data-id="${c.id}">
      <div class="lt-top">
        <div class="mi-icon" style="background:${hexToSoft(c.color)};color:${c.color}"><i class="bi ${iconClass(c.icon)}"></i></div>
        <div class="lt-count num">${c.items}</div>
      </div>
      <div class="lt-name">${App.esc(c.name)}</div>
      <div class="lt-qty">แผน ${money(c.amount_plan, 0)} บาท</div>
      ${progressBar(c.pct, c.color)}
      <div class="lt-qty" style="margin-top:6px">คงเหลือ ${money(c.remain_amount, 0)}</div>
    </button>`;
  },

  async detail(view, catId) {
    this._view = view; this._cur = catId;
    const cat = Master.cat(catId) || { name: 'ประเภทแผน', color: '#6D3FD6', icon: 'box' };

    view.innerHTML = `
      <button class="btn-ghost back-btn" id="catBack"><i class="bi bi-chevron-left"></i> กลับ</button>
      <div class="page-head">
        <div>
          <div class="page-title" style="margin-bottom:2px">${App.esc(cat.name)}</div>
          <div class="page-sub" style="margin:0">ปีงบประมาณ ${App.esc(App.fyText())}</div>
        </div>
      </div>
      <div id="catSum"></div>
      <div class="search-wrap" style="margin-top:4px">
        <i class="bi bi-search"></i>
        <input id="catSearch" autocomplete="off" placeholder="ค้นหารหัส หรือ ชื่อรายการ">
      </div>
      <div id="catItems" style="margin-top:14px">${App.loader()}</div>`;

    document.getElementById('catBack').addEventListener('click', () => this.grid(view));

    const r = await api('getPlanResult', { fiscal_year: App.fiscalYear, category_id: catId }).catch(() => null);
    const wrap = document.getElementById('catItems');
    if (!r || r.status !== 'success') { wrap.innerHTML = '<div class="hint">โหลดข้อมูลไม่ได้</div>'; return; }

    const rows = r.data || [];
    document.getElementById('catSum').innerHTML = triStat(r.total.amount_plan, r.total.used_amount, r.total.remain_amount);

    const paint = list => {
      wrap.innerHTML = list.length
        ? list.map(it => this.itemCard(it)).join('')
        : emptyState('ไม่มีรายการในประเภทนี้',
            App.isAdmin() ? 'เพิ่มได้ที่เมนู "แผนประจำปี"' : '', 'bi-journal-text');
    };
    paint(rows);

    const si = document.getElementById('catSearch');
    si.addEventListener('input', () => {
      const q = si.value.trim().toLowerCase();
      paint(!q ? rows : rows.filter(x =>
        String(x.code).toLowerCase().indexOf(q) !== -1 || String(x.name).toLowerCase().indexOf(q) !== -1));
    });
  },

  itemCard(it) {
    const over = it.remain_amount < 0 || it.remain_qty < 0;
    return `<div class="card-soft plan-card">
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div style="flex:1;min-width:0">
          <div class="pc-name">${App.esc(it.name)}</div>
          <div class="pc-code">${App.esc(it.code)} · ${App.esc(it.unit || '-')}</div>
        </div>
        ${over ? '<span class="chip chip-crit">เกินแผน</span>' : `<span class="chip chip-safe">${money(it.pct, 0)}%</span>`}
      </div>
      ${progressBar(it.pct, it.category_color)}
      <div class="pc-grid">
        <div><span>ตามแผน</span><b class="num">${qty(it.qty_plan)} ${App.esc(it.unit || '')}</b><i class="num">${money(it.amount_plan)}</i></div>
        <div><span>ขอซื้อแล้ว</span><b class="num">${qty(it.used_qty)} ${App.esc(it.unit || '')}</b><i class="num">${money(it.used_amount)}</i></div>
        <div><span>คงเหลือ</span><b class="num ${over ? 'is-over' : 'is-remain'}">${qty(it.remain_qty)} ${App.esc(it.unit || '')}</b><i class="num ${over ? 'is-over' : ''}">${money(it.remain_amount)}</i></div>
      </div>
    </div>`;
  },

  /* ---------------- จัดการประเภทแผน (admin) ---------------- */
  manage() {
    const body = App.openSheet('จัดการประเภทแผน', `
      <button class="btn-brand" id="mcAdd" style="margin-bottom:14px"><i class="bi bi-plus-lg"></i> เพิ่มประเภทแผน</button>
      <div class="hint" style="margin:0 0 10px">ใช้ปุ่มลูกศรเพื่อจัดลำดับการแสดงผล</div>
      <div id="mcList"></div>`);

    const paint = () => {
      const list = Master.cats;
      body.querySelector('#mcList').innerHTML = list.map((c, i) => `
        <div class="ord-row">
          <div class="mi-icon" style="background:${hexToSoft(c.color)};color:${c.color};width:38px;height:38px;font-size:16px"><i class="bi ${iconClass(c.icon)}"></i></div>
          <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:.94rem">${App.esc(c.name)}</div></div>
          <button class="ord-btn" data-up="${c.id}" ${i === 0 ? 'disabled' : ''}><i class="bi bi-chevron-up"></i></button>
          <button class="ord-btn" data-down="${c.id}" ${i === list.length - 1 ? 'disabled' : ''}><i class="bi bi-chevron-down"></i></button>
          <button class="ord-btn" data-edit="${c.id}"><i class="bi bi-pencil"></i></button>
        </div>`).join('') || '<div class="hint">ยังไม่มีประเภทแผน</div>';

      body.querySelectorAll('[data-edit]').forEach(b =>
        b.addEventListener('click', () => this.editForm(Master.cat(b.dataset.edit))));
      body.querySelectorAll('[data-up]').forEach(b =>
        b.addEventListener('click', () => this.move(b.dataset.up, -1, paint)));
      body.querySelectorAll('[data-down]').forEach(b =>
        b.addEventListener('click', () => this.move(b.dataset.down, 1, paint)));
    };
    paint();

    body.querySelector('#mcAdd').addEventListener('click', () => this.editForm(null));
  },

  async move(id, dir, paint) {
    const list = Master.cats;
    const i = list.findIndex(c => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    paint();
    const r = await api('reorderCategories', { ids: list.map(c => c.id) }).catch(() => null);
    if (!r || r.status !== 'success') App.toast('จัดลำดับไม่สำเร็จ', 'err');
  },

  editForm(cat) {
    const isNew = !cat;
    cat = cat || { name: '', icon: 'box', color: COLOR_SET[0] };
    const body = App.openSheet(isNew ? 'เพิ่มประเภทแผน' : 'แก้ไขประเภทแผน', `
      <div class="field"><label>ชื่อประเภทแผน <span class="req">*</span></label>
        <input type="text" id="ceName" value="${App.esc(cat.name)}" placeholder="เช่น แผนจัดซื้อยา" autocomplete="off"></div>
      <div class="pick-label">ไอคอน</div>
      <div class="icon-grid" id="ceIcons">${ICON_KEYS.map(k => `
        <button type="button" class="icon-pick ${k === cat.icon ? 'sel' : ''}" data-ic="${k}"><i class="bi ${iconClass(k)}"></i></button>`).join('')}</div>
      <div class="pick-label">สี</div>
      <div class="color-row" id="ceColors">${COLOR_SET.map(c => `
        <button type="button" class="color-dot ${c === cat.color ? 'sel' : ''}" data-c="${c}" style="background:${c}"></button>`).join('')}</div>
      <button class="btn-brand" id="ceSave" style="margin-top:18px"><i class="bi bi-check2"></i> บันทึก</button>
      ${isNew ? '' : '<button class="btn-line" id="ceDel" style="margin-top:10px"><i class="bi bi-trash"></i> ลบประเภทแผนนี้</button>'}`);

    let icon = cat.icon, color = cat.color;
    body.querySelectorAll('#ceIcons .icon-pick').forEach(b => b.addEventListener('click', () => {
      icon = b.dataset.ic;
      body.querySelectorAll('#ceIcons .icon-pick').forEach(x => x.classList.toggle('sel', x === b));
    }));
    body.querySelectorAll('#ceColors .color-dot').forEach(b => b.addEventListener('click', () => {
      color = b.dataset.c;
      body.querySelectorAll('#ceColors .color-dot').forEach(x => x.classList.toggle('sel', x === b));
    }));

    body.querySelector('#ceSave').addEventListener('click', async e => {
      const name = body.querySelector('#ceName').value.trim();
      if (!name) { App.invalid(body.querySelector('#ceName'), 'กรุณากรอกชื่อประเภทแผน'); return; }
      const btn = e.currentTarget; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
      const r = await api('saveCategory', { category: { id: cat.id, name, icon, color } }).catch(() => null);
      if (r && r.status === 'success') {
        App.closeSheet(); App.toast(r.message, 'ok');
        await Master.load(true);
        this.grid(this._view);
      } else {
        btn.disabled = false; btn.innerHTML = '<i class="bi bi-check2"></i> บันทึก';
        App.toast((r && r.message) || 'บันทึกไม่สำเร็จ', 'err');
      }
    });

    const del = body.querySelector('#ceDel');
    if (del) del.addEventListener('click', async () => {
      const ok = await App.confirm('ลบประเภทแผน', 'ลบ "' + cat.name + '" ใช่หรือไม่', 'ลบ');
      if (!ok) return;
      const r = await api('deleteCategory', { id: cat.id }).catch(() => null);
      if (r && r.status === 'success') {
        App.toast(r.message, 'ok');
        await Master.load(true);
        this.grid(this._view);
      } else App.toast((r && r.message) || 'ลบไม่สำเร็จ', 'err');
    });
  }
};

function viewPlanCategories(view) { Categories.grid(view); }
