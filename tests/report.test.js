const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');

test('plan report deducts actual purchase quantity and amount and keeps purchase dates', () => {
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(root, 'Code.gs'), 'utf8'), ctx);
  const sheets = {
    Categories: [{ id: 'cat', name: 'แผนจัดซื้อยา', sort_order: 1 }],
    Plans: [{ id: 'plan-1', fiscal_year: 2569, category_id: 'cat', code: '118863',
      name: 'ibuprofen', unit: 'กล่อง', qty_plan: 400, amount_plan: 128000, active: true }],
    Purchases: [
      { id: 'buy-1', fiscal_year: 2569, plan_id: 'plan-1', category_id: 'cat',
        qty: 10, unit_price: 388, amount: 3880, date: '2026-09-22', doc_no: 'PO-1', active: true },
      { id: 'other-plan', fiscal_year: 2569, plan_id: 'plan-2', category_id: 'cat',
        qty: 100, amount: 4000, date: '2026-09-23', active: true },
      { id: 'deleted', fiscal_year: 2569, plan_id: 'plan-1', category_id: 'cat',
        qty: 100, amount: 4000, date: '2026-09-24', active: false }
    ]
  };
  ctx.readAll_ = name => sheets[name] || [];
  ctx.readConfig_ = () => ({ hospital_name: 'โรงพยาบาลทดสอบ' });
  const report = ctx.apiGetReport_({ fiscal_year: 2569, mode: 'plan' });
  const row = report.groups[0].rows[0];
  assert.equal(row.used_qty, 10);
  assert.equal(row.used_amount, 3880);
  assert.equal(row.remain_qty, 390);
  assert.equal(row.remain_amount, 124120);
  assert.equal(row.purchase_dates[0], '2026-09-22');
  assert.equal(row.purchase_details[0].doc_no, 'PO-1');
});

test('print and Excel include only checked plan rows and recompute totals', () => {
  const writes = [];
  const ctx = vm.createContext({
    App: { esc: s => String(s), branding: {}, toast: () => {} },
    Master: { catName: () => 'แผนจัดซื้อยา' },
    money: n => Number(n).toFixed(2), qty: n => String(n), fmtDate: s => s,
    XLSX: {
      utils: { aoa_to_sheet: aoa => ({ aoa }), book_new: () => ({}), book_append_sheet: (wb, ws) => { wb.ws = ws; } },
      writeFile: (wb, filename) => writes.push({ filename, rows: wb.ws.aoa })
    }
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'report.js'), 'utf8'), ctx);
  const report = vm.runInContext('Report', ctx);
  const chosen = { id: 'plan-1', category_name: 'แผนจัดซื้อยา', code: '118863', name: 'ibuprofen',
    unit: 'กล่อง', qty_plan: 400, amount_plan: 128000, used_qty: 10, used_amount: 3880,
    remain_qty: 390, remain_amount: 124120, pct: 3.03, purchase_dates: ['2026-09-22'] };
  const omitted = { ...chosen, id: 'plan-2', code: '123456', name: 'other', amount_plan: 80000,
    used_amount: 1400, remain_amount: 78600 };
  report._data = { fiscal_year: 2569, hospital_name: 'โรงพยาบาลทดสอบ',
    groups: [{ name: 'แผนจัดซื้อยา', rows: [chosen, omitted], amount_plan: 208000,
      used_amount: 5280, remain_amount: 202720 }] };
  report._selectedPlanIds = new Set(['plan-1']);
  report._mode = 'plan';
  let printed = '';
  report.openPrintWindow = (_, html) => { printed = html; };
  report.print();
  assert.match(printed, /124120\.00/);
  assert.match(printed, /2026-09-22/);
  assert.match(printed, /ผู้สั่ง/);
  assert.match(printed, /ผู้ตรวจ/);
  assert.doesNotMatch(printed, /123456/);
  report.exportSelectedPlan();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].rows.length, 2);
  assert.equal(writes[0].rows[1][1], '118863');
  assert.equal(writes[0].rows[1][4], '2026-09-22');
});
