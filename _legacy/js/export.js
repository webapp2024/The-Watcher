/* export.js - พาร์ท 6: ส่งออกข้อมูลเป็น Excel (.xlsx) ฝั่ง client */
const Export = {
  async run(kind, from, to, btn) {
    let old;
    if (btn) { old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>'; }
    const r = await api('exportData', { kind, from, to }).catch(() => null);
    if (btn) { btn.disabled = false; btn.innerHTML = old; }

    if (!r || r.status !== 'success') { App.toast('ส่งออกไม่สำเร็จ', 'err'); return; }
    if (!r.rows.length) { App.toast('ไม่มีข้อมูลในช่วงที่เลือก', 'err'); return; }
    if (typeof XLSX === 'undefined') { App.toast('โหลดตัวสร้างไฟล์ไม่ได้', 'err'); return; }

    try {
      const aoa = [r.columns].concat(r.rows);
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = r.columns.map(() => ({ wch: 16 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'data');
      XLSX.writeFile(wb, r.filename);
      App.toast('ส่งออก ' + r.count + ' รายการแล้ว', 'ok');
    } catch (e) {
      App.toast('สร้างไฟล์ไม่สำเร็จ', 'err');
    }
  },

  screen(view) {
    const today = todayLocal();
    view.innerHTML = `${Settings.back()}
      <div class="page-title">ส่งออกข้อมูล (Excel)</div>
      <div class="page-sub">เลือกประเภทและช่วงวันที่ แล้วดาวน์โหลดเป็นไฟล์ .xlsx</div>

      <div class="field"><label>ประเภทข้อมูล</label>
        <select id="exKind">
          <option value="receive">รับเข้า (ตามวันที่)</option>
          <option value="issue">ใบเบิก (ตามวันที่)</option>
          <option value="all">การเคลื่อนไหวทั้งหมด (รับเข้า + ย้าย)</option>
          <option value="stock">สต็อกคงเหลือปัจจุบัน (ทั้งหมด)</option>
        </select></div>

      <div id="exRange">
        <div class="d-flex gap-2">
          <div class="field flex-fill"><label>ตั้งแต่วันที่</label><input type="date" id="exFrom" value="${today}"></div>
          <div class="field flex-fill"><label>ถึงวันที่</label><input type="date" id="exTo" value="${today}"></div>
        </div>
        <div class="d-flex gap-2" style="margin-bottom:16px">
          <button class="btn-ghost" id="exToday" style="width:auto">วันนี้</button>
          <button class="btn-ghost" id="exMonth" style="width:auto">เดือนนี้</button>
        </div>
      </div>

      <button id="exGo" class="btn-brand"><i class="bi bi-file-earmark-excel"></i> ส่งออก Excel</button>
      <p class="hint" style="margin-top:14px">เปิดไฟล์ด้วย Excel หรือ Google Sheets ได้ รองรับภาษาไทย</p>`;

    const kindSel = document.getElementById('exKind');
    const range = document.getElementById('exRange');
    kindSel.addEventListener('change', () => { range.style.display = kindSel.value === 'stock' ? 'none' : 'block'; });

    document.getElementById('exToday').addEventListener('click', () => {
      document.getElementById('exFrom').value = today; document.getElementById('exTo').value = today;
    });
    document.getElementById('exMonth').addEventListener('click', () => {
      const d = new Date();
      const first = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-01';
      document.getElementById('exFrom').value = first; document.getElementById('exTo').value = today;
    });

    document.getElementById('exGo').addEventListener('click', (e) => {
      const kind = kindSel.value;
      const from = document.getElementById('exFrom').value;
      const to = document.getElementById('exTo').value;
      this.run(kind, kind === 'stock' ? '' : from, kind === 'stock' ? '' : to, e.currentTarget);
    });
  }
};
