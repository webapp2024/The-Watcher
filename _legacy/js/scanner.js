/* scanner.js - รองรับ 2 แบบ
   1) เครื่องยิงบาร์โค้ด (HID / keyboard-wedge): ยิงเข้าช่อง input ที่โฟกัสอยู่ แล้วจบด้วย Enter
   2) กล้องมือถือ: ใช้ html5-qrcode (ทำงานได้เพราะ host บน GitHub Pages ไม่ใช่ iframe ของ GAS)
*/
const Scanner = {
  _cam: null,
  _elementId: null,

  /* ---- HID: ผูกช่อง input ให้รับค่าจากเครื่องยิง + พิมพ์มือ ----
     เครื่องยิงส่วนใหญ่ส่ง Enter/CR ปิดท้าย -> จับที่ keydown Enter
     ถ้าพิมพ์เร็วผิดมนุษย์ (อักขระห่างกัน < ~35ms) ถือว่ามาจากเครื่องยิง */
  bindInput(inputEl, onScan, opts) {
    opts = opts || {};
    const clearAfter = opts.clear !== false; // ค่าเริ่มต้น: เคลียร์หลังยิง (สำหรับช่องสแกนที่ใช้ trigger)
    let lastTime = 0, fastCount = 0, total = 0;
    inputEl.addEventListener('keydown', (e) => {
      const t = Date.now();
      if (e.key === 'Enter') {
        e.preventDefault();
        const code = inputEl.value.trim();
        if (code) {
          const source = (total > 2 && fastCount / total > 0.6) ? 'hid' : 'manual';
          onScan(code, source);
          if (clearAfter) inputEl.value = '';
        }
        lastTime = 0; fastCount = 0; total = 0;
        return;
      }
      if (e.key.length === 1) {
        if (lastTime && (t - lastTime) < 35) fastCount++;
        total++;
        lastTime = t;
      }
    });
  },

  /* ---- กล้อง ---- */
  isCameraOpen() { return !!this._cam; },

  async startCamera(elementId, onScan) {
    if (typeof Html5Qrcode === 'undefined') throw new Error('ไม่พบไลบรารีกล้อง (html5-qrcode)');
    if (this._cam) await this.stopCamera();

    const box = document.getElementById(elementId);
    if (!box) throw new Error('ไม่พบกล่องกล้อง');
    this._elementId = elementId;
    box.classList.add('cam-active');

    this._cam = new Html5Qrcode(elementId, { verbose: false });
    try {
      await this._cam.start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: { width: 250, height: 160 }, aspectRatio: 1.3 },
        (decoded) => { onScan(decoded, 'cam'); },
        () => {}
      );
    } catch (e) {
      try { this._cam.clear(); } catch (_) {}
      this._cam = null;
      box.classList.remove('cam-active');
      box.innerHTML = '';
      this._elementId = null;
      throw e;
    }
  },

  async stopCamera() {
    if (!this._cam) return;
    const id = this._elementId;
    try { await this._cam.stop(); } catch (e) {}
    try { this._cam.clear(); } catch (e) {}
    this._cam = null;
    this._elementId = null;
    const box = id && document.getElementById(id);
    if (box) { box.innerHTML = ''; box.classList.remove('cam-active'); }
  }
};
