/* settings.js - ตั้งค่า: ข้อมูลโรงพยาบาล · จัดการผู้ใช้ · ทะเบียนรายการ · หน่วยนับ · การแสดงผล · บัญชี */
const Settings = {
  _view: null,

  render(view) {
    this._view = view;
    const admin = App.isAdmin();
    const u = App.user || {};

    const items = [];
    if (admin) {
      items.push({ k: 'hospital', ic: 'bi-hospital-fill', c: 'c-indigo', t: 'ข้อมูลโรงพยาบาล', d: 'ชื่อ โลโก้ ปีงบประมาณ' });
      items.push({ k: 'users',    ic: 'bi-people-fill',   c: 'c-teal',   t: 'จัดการผู้ใช้', d: 'เพิ่ม/แก้ไข/ลบ/รีเซ็ตรหัสผ่าน' });
      items.push({ k: 'products', ic: 'bi-upc-scan',      c: 'c-violet', t: 'ทะเบียนรายการ', d: 'รหัส ชื่อ หน่วยนับ ที่บันทึกไว้' });
      items.push({ k: 'units',    ic: 'bi-rulers',        c: 'c-amber',  t: 'หน่วยนับ', d: 'ตัวเลือกในช่องหน่วยนับ' });
      items.push({ k: 'report',   ic: 'bi-file-earmark-text-fill', c: 'c-coral', t: 'รายงาน', d: 'สรุปการจัดซื้อ · ส่งออก Excel · พิมพ์' });
    }
    items.push({ k: 'display', ic: 'bi-palette-fill',  c: 'c-violet', t: 'การแสดงผล', d: 'โหมดมืด · ปีพุทธศักราช' });
    items.push({ k: 'account', ic: 'bi-person-badge-fill', c: 'c-coral', t: 'บัญชีผู้ใช้', d: 'เปลี่ยนรหัสผ่าน · ออกจากระบบ' });

    view.innerHTML = `
      <div class="page-title">ตั้งค่า</div>
      <div class="page-sub">${App.esc(u.username || '')} · ${App.esc(u.role_name || (admin ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'))}</div>
      ${items.map(i => `
        <button class="menu-item" data-k="${i.k}">
          <div class="mi-icon ${i.c}"><i class="bi ${i.ic}"></i></div>
          <div class="mi-body"><div class="mi-title">${i.t}</div><div class="mi-desc">${i.d}</div></div>
          <i class="bi bi-chevron-right mi-arrow"></i>
        </button>`).join('')}
      <div class="hint" style="text-align:center;margin-top:22px">
        ${App.esc(App.branding.app_name || 'The Watcher')} v${App.esc(App.branding.app_version || '')}
      </div>`;

    view.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.k;
      if (k === 'report') { App.navigate('report'); return; }
      this[k](view);
    }));
  },

  head(title, sub) {
    return `<button class="btn-ghost back-btn" id="stBack"><i class="bi bi-chevron-left"></i> ตั้งค่า</button>
      <div class="page-title">${App.esc(title)}</div>
      ${sub ? `<div class="page-sub">${App.esc(sub)}</div>` : ''}`;
  },

  bindBack(view) {
    const b = document.getElementById('stBack');
    if (b) b.addEventListener('click', () => this.render(view));
  },

  /* ---------------- ข้อมูลโรงพยาบาล ---------------- */
  async hospital(view) {
    view.innerHTML = this.head('ข้อมูลโรงพยาบาล', 'ชื่อ โลโก้ และปีงบประมาณเริ่มต้น') + App.loader();
    this.bindBack(view);

    const r = await api('getConfig').catch(() => null);
    if (!r || r.status !== 'success') { view.insertAdjacentHTML('beforeend', '<div class="hint">โหลดข้อมูลไม่ได้</div>'); return; }
    const c = r.config;

    view.innerHTML = this.head('ข้อมูลโรงพยาบาล', 'ชื่อ โลโก้ และปีงบประมาณเริ่มต้น') + `
      <div class="card-soft form-card">
        <div class="field"><label>ชื่อโรงพยาบาล / หน่วยงาน</label>
          <input type="text" id="cfName" value="${App.esc(c.hospital_name || '')}" autocomplete="off"></div>

        <div class="field"><label>โลโก้</label>
          <div class="logo-preview" id="cfLogo">
            ${c.logo_url ? `<img src="${c.logo_url}" alt="logo">` : '<i class="bi bi-image"></i>'}
          </div>
          <div class="d-flex gap-2" style="margin-top:10px">
            <button class="btn-ghost" id="cfPick" style="flex:1"><i class="bi bi-upload"></i> เลือกรูป</button>
            ${c.logo_url ? '<button class="btn-ghost btn-danger-ghost" id="cfDelLogo" style="flex:none">ลบ</button>' : ''}
          </div>
          <input type="file" id="cfFile" accept="image/*" style="display:none">
        </div>

        <div class="field"><label>ปีงบประมาณเริ่มต้น (พ.ศ.)</label>
          <input type="number" id="cfYear" value="${c.fiscal_year || ''}" inputmode="numeric">
          <div class="hint">ใช้เป็นปีเริ่มต้นเมื่อเปิดแอป · เปลี่ยนชั่วคราวได้ที่ปุ่มปีงบในแต่ละหน้า</div>
        </div>

        <div class="form-check form-switch" style="margin-bottom:6px">
          <input class="form-check-input" type="checkbox" id="cfBlock" ${c.block_over_plan !== false ? 'checked' : ''}>
          <label class="form-check-label" for="cfBlock">กันการขอซื้อเกินแผน</label>
        </div>
        <div class="hint" style="margin:0 0 18px">เปิดไว้ ระบบจะไม่ให้บันทึกรายการที่เกินจำนวน/วงเงินตามแผน (ผู้ดูแลระบบยืนยันทับได้)</div>

        <button class="btn-brand" id="cfSave"><i class="bi bi-check2"></i> บันทึก</button>
      </div>`;
    this.bindBack(view);

    document.getElementById('cfPick').addEventListener('click', () => document.getElementById('cfFile').click());
    document.getElementById('cfFile').addEventListener('change', e => this.uploadLogo(e, view));

    const delLogo = document.getElementById('cfDelLogo');
    if (delLogo) delLogo.addEventListener('click', async () => {
      const ok = await App.confirm('ลบโลโก้', 'ลบโลโก้ปัจจุบันใช่หรือไม่', 'ลบ');
      if (!ok) return;
      const rr = await api('removeLogo').catch(() => null);
      if (rr && rr.status === 'success') {
        App.branding.logo_url = '';
        App.renderHeader(); App.paintLoginBrand();
        App.toast(rr.message, 'ok');
        this.hospital(view);
      } else App.toast('ลบไม่สำเร็จ', 'err');
    });

    document.getElementById('cfSave').addEventListener('click', async e => {
      const name = document.getElementById('cfName').value.trim();
      const year = parseInt(document.getElementById('cfYear').value, 10);
      if (!name) { App.invalid('cfName', 'กรุณากรอกชื่อโรงพยาบาล'); return; }
      if (!year || year < 2400 || year > 2700) { App.invalid('cfYear', 'ใส่ปีงบเป็น พ.ศ. เช่น 2569'); return; }

      const btn = e.currentTarget; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
      const rr = await api('saveConfig', {
        config: {
          hospital_name: name,
          fiscal_year: year,
          block_over_plan: document.getElementById('cfBlock').checked
        }
      }).catch(() => null);
      btn.disabled = false; btn.innerHTML = '<i class="bi bi-check2"></i> บันทึก';

      if (rr && rr.status === 'success') {
        App.branding.hospital_name = name;
        App.fiscalYear = year;
        Master.year = year;
        if (Master.years.indexOf(year) === -1) Master.years.push(year);
        App.renderHeader(); App.paintLoginBrand();
        App.toast(rr.message, 'ok');
      } else App.toast((rr && rr.message) || 'บันทึกไม่สำเร็จ', 'err');
    });
  },

  uploadLogo(e, view) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { App.toast('ไฟล์ใหญ่เกิน 3 MB', 'err'); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      App.showLoading('กำลังอัปโหลดโลโก้');
      const r = await api('uploadLogo', { base64: reader.result, filename: file.name }).catch(() => null);
      App.hideLoading();
      if (r && r.status === 'success') {
        App.branding.logo_url = r.logo_url;
        App.renderHeader(); App.paintLoginBrand();
        App.toast(r.message, 'ok');
        this.hospital(view);
      } else App.toast((r && r.message) || 'อัปโหลดไม่สำเร็จ', 'err');
    };
    reader.readAsDataURL(file);
  },

  /* ---------------- จัดการผู้ใช้ ---------------- */
  async users(view) {
    view.innerHTML = this.head('จัดการผู้ใช้', 'ผู้ดูแลระบบใช้ได้ทุกเมนู · ผู้ใช้งานเพิ่มได้เฉพาะหน้าขออนุมัติซื้อและดูผล') + `
      <button class="btn-brand" id="usAdd" style="margin-bottom:16px"><i class="bi bi-person-plus-fill"></i> เพิ่มผู้ใช้</button>
      <div id="usList">${App.loader()}</div>`;
    this.bindBack(view);
    document.getElementById('usAdd').addEventListener('click', () => this.userForm(null, view));

    const r = await api('getUsers').catch(() => null);
    const box = document.getElementById('usList');
    if (!r || r.status !== 'success') { box.innerHTML = '<div class="hint">โหลดข้อมูลไม่ได้</div>'; return; }

    box.innerHTML = (r.data || []).map(u => `
      <button class="menu-item" data-u="${u.id}">
        <div class="mi-icon ${u.role === 'admin' ? 'c-coral' : 'c-teal'}">
          <i class="bi ${u.role === 'admin' ? 'bi-shield-lock-fill' : 'bi-person-fill'}"></i></div>
        <div class="mi-body">
          <div class="mi-title">${App.esc(u.name)} ${u.active ? '' : '<span class="chip chip-crit">ปิดใช้งาน</span>'}</div>
          <div class="mi-desc">${App.esc(u.username)} · ${App.esc(u.role_name)}</div>
        </div>
        <i class="bi bi-chevron-right mi-arrow"></i>
      </button>`).join('') || '<div class="hint">ยังไม่มีผู้ใช้</div>';

    box.querySelectorAll('[data-u]').forEach(b => b.addEventListener('click', () =>
      this.userForm((r.data || []).find(x => x.id === b.dataset.u), view)));
  },

  userForm(u, view) {
    const isNew = !u;
    u = u || { username: '', name: '', role: 'user', active: true };
    const body = App.openSheet(isNew ? 'เพิ่มผู้ใช้' : 'แก้ไขผู้ใช้', `
      <div class="field"><label>ชื่อผู้ใช้ (สำหรับเข้าระบบ) <span class="req">*</span></label>
        <input type="text" id="uuUser" value="${App.esc(u.username)}" autocomplete="off"></div>
      <div class="field"><label>ชื่อ-สกุล / ชื่อที่แสดง</label>
        <input type="text" id="uuName" value="${App.esc(u.name || '')}" autocomplete="off"></div>
      <div class="field"><label>บทบาท</label>
        <select id="uuRole">
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>ผู้ดูแลระบบ - ใช้ได้ทุกเมนู</option>
          <option value="user" ${u.role !== 'admin' ? 'selected' : ''}>ผู้ใช้งาน - ขออนุมัติซื้อ + ดูผล/แดชบอร์ด</option>
        </select></div>
      <div class="field"><label>${isNew ? 'รหัสผ่าน' : 'รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)'} ${isNew ? '<span class="req">*</span>' : ''}</label>
        <input type="password" id="uuPass" autocomplete="new-password" placeholder="อย่างน้อย 4 ตัวอักษร"></div>
      ${isNew ? '' : `<div class="form-check form-switch" style="margin-bottom:18px">
        <input class="form-check-input" type="checkbox" id="uuActive" ${u.active ? 'checked' : ''}>
        <label class="form-check-label" for="uuActive">เปิดใช้งานบัญชีนี้</label></div>`}
      <button class="btn-brand" id="uuSave"><i class="bi bi-check2"></i> บันทึก</button>
      ${isNew ? '' : '<button class="btn-line" id="uuDel" style="margin-top:10px"><i class="bi bi-trash"></i> ลบผู้ใช้นี้</button>'}`);

    body.querySelector('#uuSave').addEventListener('click', async e => {
      const username = body.querySelector('#uuUser').value.trim();
      const pass = body.querySelector('#uuPass').value;
      if (!username) { App.invalid(body.querySelector('#uuUser'), 'กรุณากรอกชื่อผู้ใช้'); return; }
      if (isNew && pass.length < 4) { App.invalid(body.querySelector('#uuPass'), 'ตั้งรหัสผ่านอย่างน้อย 4 ตัวอักษร'); return; }
      if (!isNew && pass && pass.length < 4) { App.invalid(body.querySelector('#uuPass'), 'รหัสผ่านอย่างน้อย 4 ตัวอักษร'); return; }

      const payload = {
        id: u.id, username,
        name: body.querySelector('#uuName').value.trim(),
        role: body.querySelector('#uuRole').value
      };
      if (pass) payload.password = pass;
      const act = body.querySelector('#uuActive');
      if (act) payload.active = act.checked;

      const btn = e.currentTarget; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
      const r = await api('saveUser', { user: payload }).catch(() => null);
      if (r && r.status === 'success') { App.closeSheet(); App.toast(r.message, 'ok'); this.users(view); }
      else { btn.disabled = false; btn.innerHTML = '<i class="bi bi-check2"></i> บันทึก'; App.toast((r && r.message) || 'บันทึกไม่สำเร็จ', 'err'); }
    });

    const del = body.querySelector('#uuDel');
    if (del) del.addEventListener('click', async () => {
      const ok = await App.confirm('ลบผู้ใช้', 'ลบบัญชี "' + u.username + '" ใช่หรือไม่', 'ลบ');
      if (!ok) return;
      const r = await api('deleteUser', { id: u.id }).catch(() => null);
      if (r && r.status === 'success') { App.closeSheet(); App.toast(r.message, 'ok'); this.users(view); }
      else App.toast((r && r.message) || 'ลบไม่สำเร็จ', 'err');
    });
  },

  /* ---------------- ทะเบียนรายการ ---------------- */
  async products(view) {
    view.innerHTML = this.head('ทะเบียนรายการ', 'รหัส / ชื่อ / หน่วยนับ ที่บันทึกไว้ครั้งแรก ใช้ซ้ำได้ทุกหน้า') + `
      <button class="btn-brand" id="prAdd" style="margin-bottom:14px"><i class="bi bi-plus-lg"></i> เพิ่มรายการ</button>
      <div class="search-wrap" style="margin-top:0">
        <i class="bi bi-search"></i>
        <input id="prQ" autocomplete="off" placeholder="ค้นหารหัส หรือ ชื่อรายการ">
      </div>
      <div id="prList" style="margin-top:14px">${App.loader()}</div>`;
    this.bindBack(view);
    document.getElementById('prAdd').addEventListener('click', () => this.productForm(null, view));

    const load = async q => {
      const box = document.getElementById('prList');
      box.innerHTML = App.loader();
      const r = await api('searchProducts', { q: q || '' }).catch(() => null);
      const list = (r && r.data) || [];
      box.innerHTML = list.length ? list.map(p => `
        <button class="menu-item" data-p="${p.id}">
          <div class="mi-icon c-indigo"><i class="bi bi-upc"></i></div>
          <div class="mi-body">
            <div class="mi-title">${App.esc(p.name)}</div>
            <div class="mi-desc">${App.esc(p.code)} · ${App.esc(p.unit || '-')}</div>
          </div>
          <i class="bi bi-chevron-right mi-arrow"></i>
        </button>`).join('') : '<div class="hint">ไม่พบรายการ</div>';
      box.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () =>
        this.productForm(list.find(x => x.id === b.dataset.p), view)));
    };

    let t = null;
    document.getElementById('prQ').addEventListener('input', e => {
      clearTimeout(t); const v = e.target.value.trim();
      t = setTimeout(() => load(v), 300);
    });
    load('');
  },

  productForm(p, view) {
    const isNew = !p;
    p = p || { code: '', name: '', unit: '', category_id: '' };
    const body = App.openSheet(isNew ? 'เพิ่มรายการ' : 'แก้ไขรายการ', `
      <div class="field"><label>รหัสรายการ <span class="req">*</span></label>
        <input type="text" id="pfCode" value="${App.esc(p.code)}" autocomplete="off"></div>
      <div class="field"><label>ชื่อ <span class="req">*</span></label>
        <input type="text" id="pfName" value="${App.esc(p.name)}" autocomplete="off"></div>
      <div class="field"><label>หน่วยนับ <span class="req">*</span></label>
        <select id="pfUnit">${Master.unitOptions(p.unit)}</select></div>
      <div class="field"><label>ประเภทแผนหลัก (ถ้ามี)</label>
        <select id="pfCat">${Master.catOptions(p.category_id, 'ไม่ระบุ')}</select></div>
      <div class="hint" style="margin:0 0 16px">แก้ชื่อหรือหน่วยนับที่นี่ ระบบจะอัปเดตให้ทุกแถวในแผนและใบขออนุมัติซื้อที่อ้างถึงรายการนี้</div>
      <button class="btn-brand" id="pfSave"><i class="bi bi-check2"></i> บันทึก</button>
      ${isNew ? '' : '<button class="btn-line" id="pfDel" style="margin-top:10px"><i class="bi bi-trash"></i> ลบรายการนี้</button>'}`);

    body.querySelector('#pfSave').addEventListener('click', async e => {
      const code = body.querySelector('#pfCode').value.trim();
      const name = body.querySelector('#pfName').value.trim();
      const unit = body.querySelector('#pfUnit').value;
      if (!code) { App.invalid(body.querySelector('#pfCode'), 'กรุณากรอกรหัสรายการ'); return; }
      if (!name) { App.invalid(body.querySelector('#pfName'), 'กรุณากรอกชื่อรายการ'); return; }
      if (!unit) { App.invalid(body.querySelector('#pfUnit'), 'กรุณาเลือกหน่วยนับ'); return; }

      const btn = e.currentTarget; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
      const r = await api('saveProduct', {
        product: { id: p.id, code, name, unit, category_id: body.querySelector('#pfCat').value }
      }).catch(() => null);
      if (r && r.status === 'success') { App.closeSheet(); App.toast(r.message, 'ok'); this.products(view); }
      else { btn.disabled = false; btn.innerHTML = '<i class="bi bi-check2"></i> บันทึก'; App.toast((r && r.message) || 'บันทึกไม่สำเร็จ', 'err'); }
    });

    const del = body.querySelector('#pfDel');
    if (del) del.addEventListener('click', async () => {
      const ok = await App.confirm('ลบรายการ', 'ลบ "' + p.name + '" ออกจากทะเบียนใช่หรือไม่', 'ลบ');
      if (!ok) return;
      const r = await api('deleteProduct', { id: p.id }).catch(() => null);
      if (r && r.status === 'success') { App.closeSheet(); App.toast(r.message, 'ok'); this.products(view); }
      else App.toast((r && r.message) || 'ลบไม่สำเร็จ', 'err');
    });
  },

  /* ---------------- หน่วยนับ ---------------- */
  units(view) {
    const paint = () => {
      view.innerHTML = this.head('หน่วยนับ', 'ตัวเลือกที่แสดงในช่องหน่วยนับทุกหน้า') + `
        <div class="field">
          <div class="d-flex gap-2">
            <input type="text" id="unNew" placeholder="เพิ่มหน่วยนับ เช่น แผง" autocomplete="off" style="flex:1">
            <button class="btn-ghost" id="unAdd" style="width:auto;flex:none">เพิ่ม</button>
          </div>
        </div>
        <div id="unList">${Master.units.map(u => `
          <div class="ord-row">
            <div style="flex:1;min-width:0;font-weight:600">${App.esc(u.name)}</div>
            <button class="ord-btn" data-edit="${u.id}"><i class="bi bi-pencil"></i></button>
            <button class="ord-btn ord-danger" data-del="${u.id}"><i class="bi bi-trash"></i></button>
          </div>`).join('') || '<div class="hint">ยังไม่มีหน่วยนับ</div>'}</div>`;
      this.bindBack(view);

      document.getElementById('unAdd').addEventListener('click', async () => {
        const name = document.getElementById('unNew').value.trim();
        if (!name) { App.invalid('unNew', 'กรอกชื่อหน่วยนับ'); return; }
        const r = await api('saveUnit', { unit: { name } }).catch(() => null);
        if (r && r.status === 'success') { App.toast(r.message, 'ok'); await Master.load(true); paint(); }
        else App.toast((r && r.message) || 'เพิ่มไม่สำเร็จ', 'err');
      });

      view.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
        const u = Master.units.find(x => x.id === b.dataset.edit);
        const body = App.openSheet('แก้ไขหน่วยนับ', `
          <div class="field"><label>ชื่อหน่วยนับ</label><input type="text" id="unEd" value="${App.esc(u.name)}"></div>
          <button class="btn-brand" id="unEdSave"><i class="bi bi-check2"></i> บันทึก</button>`);
        body.querySelector('#unEdSave').addEventListener('click', async () => {
          const name = body.querySelector('#unEd').value.trim();
          if (!name) { App.invalid(body.querySelector('#unEd'), 'กรอกชื่อหน่วยนับ'); return; }
          const r = await api('saveUnit', { unit: { id: u.id, name } }).catch(() => null);
          if (r && r.status === 'success') { App.closeSheet(); App.toast(r.message, 'ok'); await Master.load(true); paint(); }
          else App.toast((r && r.message) || 'บันทึกไม่สำเร็จ', 'err');
        });
      }));

      view.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
        const u = Master.units.find(x => x.id === b.dataset.del);
        const ok = await App.confirm('ลบหน่วยนับ', 'ลบ "' + u.name + '" ใช่หรือไม่ (รายการที่ใช้อยู่แล้วจะไม่ถูกแก้)', 'ลบ');
        if (!ok) return;
        const r = await api('deleteUnit', { id: u.id }).catch(() => null);
        if (r && r.status === 'success') { App.toast(r.message, 'ok'); await Master.load(true); paint(); }
        else App.toast((r && r.message) || 'ลบไม่สำเร็จ', 'err');
      }));
    };
    paint();
  },

  /* ---------------- การแสดงผล ---------------- */
  display(view) {
    view.innerHTML = this.head('การแสดงผล', 'ปรับให้เข้ากับการใช้งานของคุณ') + `
      <div class="card-soft form-card">
        <div class="form-check form-switch" style="margin-bottom:14px">
          <input class="form-check-input" type="checkbox" id="dpDark" ${App.isDark() ? 'checked' : ''}>
          <label class="form-check-label" for="dpDark">โหมดมืด</label>
        </div>
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" id="dpBe" ${App.beYear ? 'checked' : ''}>
          <label class="form-check-label" for="dpBe">แสดงวันที่เป็นปีพุทธศักราช (พ.ศ.)</label>
        </div>
        ${App.isAdmin() ? '<div class="hint" style="margin-top:10px">การตั้งค่า พ.ศ. จะบันทึกให้ผู้ใช้ทุกคน</div>' : ''}
      </div>`;
    this.bindBack(view);

    document.getElementById('dpDark').addEventListener('change', e => App.setTheme(e.target.checked));
    document.getElementById('dpBe').addEventListener('change', async e => {
      App.beYear = e.target.checked;
      if (App.isAdmin()) {
        const r = await api('saveConfig', { config: { display_be: App.beYear } }).catch(() => null);
        if (r && r.status === 'success') App.toast('บันทึกแล้ว', 'ok');
      }
    });
  },

  /* ---------------- บัญชีผู้ใช้ ---------------- */
  account(view) {
    const u = App.user || {};
    view.innerHTML = this.head('บัญชีผู้ใช้', App.esc(u.username || '')) + `
      <div class="card-soft form-card">
        <div class="form-head"><i class="bi bi-key-fill"></i><span>เปลี่ยนรหัสผ่าน</span></div>
        <div class="field"><label>รหัสผ่านเดิม</label><input type="password" id="pwOld" autocomplete="current-password"></div>
        <div class="field"><label>รหัสผ่านใหม่</label><input type="password" id="pwNew" autocomplete="new-password" placeholder="อย่างน้อย 4 ตัวอักษร"></div>
        <div class="field"><label>ยืนยันรหัสผ่านใหม่</label><input type="password" id="pwNew2" autocomplete="new-password"></div>
        <button class="btn-brand" id="pwSave"><i class="bi bi-check2"></i> เปลี่ยนรหัสผ่าน</button>
      </div>
      <button class="btn-line" id="acLogout" style="margin-top:18px"><i class="bi bi-box-arrow-right"></i> ออกจากระบบ</button>`;
    this.bindBack(view);

    document.getElementById('pwSave').addEventListener('click', async e => {
      const o = document.getElementById('pwOld').value;
      const n = document.getElementById('pwNew').value;
      const n2 = document.getElementById('pwNew2').value;
      if (!o) { App.invalid('pwOld', 'กรอกรหัสผ่านเดิม'); return; }
      if (n.length < 4) { App.invalid('pwNew', 'รหัสผ่านใหม่อย่างน้อย 4 ตัวอักษร'); return; }
      if (n !== n2) { App.invalid('pwNew2', 'รหัสผ่านใหม่ไม่ตรงกัน'); return; }

      const btn = e.currentTarget; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
      const r = await api('changePassword', { old_password: o, new_password: n }).catch(() => null);
      btn.disabled = false; btn.innerHTML = '<i class="bi bi-check2"></i> เปลี่ยนรหัสผ่าน';
      if (r && r.status === 'success') {
        App.toast(r.message, 'ok');
        ['pwOld', 'pwNew', 'pwNew2'].forEach(id => { document.getElementById(id).value = ''; });
      } else App.toast((r && r.message) || 'เปลี่ยนรหัสผ่านไม่สำเร็จ', 'err');
    });

    document.getElementById('acLogout').addEventListener('click', async () => {
      const ok = await App.confirm('ออกจากระบบ', 'ต้องการออกจากระบบใช่หรือไม่', 'ออกจากระบบ');
      if (ok) App.logout();
    });
  }
};
