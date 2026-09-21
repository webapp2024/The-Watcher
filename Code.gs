/**
 * The Watcher - ระบบติดตามแผนจัดซื้อ (Procurement Plan Tracker)
 * Backend: Google Apps Script (JSON API) + Google Sheets (JSON-per-row)
 *
 * โครงระบบ
 *  1) ประเภทแผน       - 17 ประเภทเริ่มต้น แก้ไข/เพิ่ม/ลบ/จัดลำดับได้
 *  2) แผนประจำปี       - รายการที่ได้รับอนุมัติตามแผน (จำนวน + วงเงิน) แยกตามปีงบประมาณ
 *  3) ขออนุมัติซื้อ     - ตัดจำนวน/วงเงินออกจากแผน กันซื้อเกินแผน
 *  4) ผลตามแผน        - แผน / ผลตามแผน / คงเหลือ
 *  5) แดชบอร์ด+รายงาน  - สรุปวงเงินที่ซื้อไป และคงเหลือ แยกตามประเภท
 *
 * วิธีติดตั้ง (ดู README.md):
 *  1) วาง Code.gs นี้ในโปรเจกต์ Apps Script ที่ผูกกับ Google Sheet
 *  2) รันฟังก์ชัน setup() หนึ่งครั้ง (อนุญาตสิทธิ์ Drive/Sheets)
 *  3) Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone
 *  4) คัดลอก URL /exec ไปใส่ js/api.js (ค่า API_URL)
 *
 * หมายเหตุ: ชีตของระบบเดิม (Locations/Drugs/Items/Transactions) จะไม่ถูกแตะต้อง
 *           ระบบนี้สร้างชีตใหม่ Categories/Units/Products/Plans/Purchases
 */

// ============================================================ CONFIG
var CONFIG = {
  APP_NAME: 'The Watcher',
  APP_VERSION: '2.0',
  HOSPITAL_NAME: 'โรงพยาบาลร้องกวาง',
  SESSION_TIMEOUT: 8 * 60 * 60 * 1000, // 8 ชม.
  FOLDER_NAME: 'The Watcher - Files',

  // ผู้ใช้เริ่มต้น (เปลี่ยนรหัสผ่านหลังติดตั้ง)
  ADMIN_USERS: {
    admin: 'admin1234'
  },

  // admin = ทุกเมนู · user = เพิ่มข้อมูลได้เฉพาะหน้าขออนุมัติซื้อ + ดูผล/แดชบอร์ด
  USER_ROLES: {
    admin: { name: 'ผู้ดูแลระบบ', permissions: ['*'] },
    user:  { name: 'ผู้ใช้งาน',    permissions: ['purchase', 'view'] }
  },

  SHEET_KEYS: {
    Config:     'config_json',
    Categories: 'category_json',
    Units:      'unit_json',
    Products:   'product_json',
    Plans:      'plan_json',
    Purchases:  'purchase_json',
    Users:      'user_json',
    Sessions:   'session_json',
    Errors:     'error_json'
  },

  // ประเภทแผน (ตามเอกสาร) [ชื่อ, ไอคอน, สี]
  DEFAULT_CATEGORIES: [
    ['แผนจัดซื้อยา',                       'capsule',      '#6D3FD6'],
    ['แผนจัดซื้อเวชภัณฑ์มิใช่ยา',            'bandaid',      '#0EA5A5'],
    ['แผนจัดซื้อวัสดุการแพทย์',              'heartpulse',   '#E8556D'],
    ['แผนจัดซื้อวัสดุวิทยาศาสตร์การแพทย์',    'flask',        '#2563EB'],
    ['แผนจัดซื้อวัสดุทันตกรรมคงรูป',          'tooth',        '#0891B2'],
    ['แผนจัดซื้อวัสดุทันตกรรมสิ้นเปลือง',      'tooth',        '#14B8A6'],
    ['แผนจัดซื้อวัสดุรังสี',                 'radioactive',  '#F59E0B'],
    ['แผนจัดซื้อวัสดุเครื่องบริโภค',          'cup',          '#D97706'],
    ['แผนจัดซื้อวัสดุเครื่องแต่งกาย',         'shirt',        '#7C3AED'],
    ['แผนจัดซื้อวัสดุงานบ้านงานครัว',         'house',        '#16A34A'],
    ['แผนจัดซื้อวัสดุสำนักงาน',              'pencil',       '#2563EB'],
    ['แผนจัดซื้อวัสดุคอมพิวเตอร์',           'pc',           '#4F46E5'],
    ['แผนจัดซื้อวัสดุงานซ่อมบำรุง',          'tools',        '#EA580C'],
    ['แผนจัดซื้อวัสดุอื่น ๆ',                'box',          '#64748B'],
    ['แผนจัดซื้อวัสดุเภสัชกรรม',             'prescription', '#9333EA'],
    ['แผนจัดซื้อครุภัณฑ์',                   'printer',      '#0F766E'],
    ['แผนพัฒนาบุคลากร',                     'people',       '#DB2777']
  ],

  DEFAULT_UNITS: [
    'แผง', 'กล่อง', 'ขวด', 'หลอด', 'ชิ้น', 'อัน', 'ชุด', 'แพ็ค', 'ห่อ', 'ซอง',
    'ม้วน', 'กระป๋อง', 'ถุง', 'ลัง', 'โหล', 'คู่', 'ตัว', 'เล่ม', 'ใบ', 'แท่ง',
    'เครื่อง', 'ถัง', 'กิโลกรัม', 'ลิตร', 'เมตร', 'คน', 'ครั้ง'
  ]
};

// ============================================================ ENTRY / ROUTER
function doGet(e)  { return handle_(e, 'GET'); }
function doPost(e) { return handle_(e, 'POST'); }

function handle_(e, method) {
  try {
    var p = {};
    if (method === 'POST' && e && e.postData && e.postData.contents) {
      // POST แบบ text/plain เพื่อเลี่ยง CORS preflight
      p = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      p = e.parameter;
      if (p.payload) { try { p = JSON.parse(p.payload); } catch (_) {} }
    }
    return jsonOut_(route_(p.action, p));
  } catch (err) {
    logError_('handle_', err);
    return jsonOut_({ status: 'error', message: 'เกิดข้อผิดพลาด: ' + err });
  }
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function route_(action, p) {
  switch (action) {
    // ---- public ----
    case 'ping':     return { status: 'success', message: 'pong', time: now_() };
    case 'branding': return apiBranding_();
    case 'login':    return apiLogin_(p.username, p.password);

    // ---- auth ----
    case 'logout': return apiLogout_(p.token);
    case 'me':     return guard_(p, ['view'], function (u) { return { status: 'success', user: publicUser_(u) }; });
    case 'changePassword': return guard_(p, ['view'], function (u) { return apiChangePassword_(p, u); });

    // ---- ตั้งค่า ----
    case 'getConfig':     return guard_(p, ['*'], function () { return apiGetConfig_(); });
    case 'saveConfig':    return guard_(p, ['*'], function () { return apiSaveConfig_(p.config); });
    case 'uploadLogo':    return guard_(p, ['*'], function () { return apiUploadLogo_(p.base64, p.filename); });
    case 'removeLogo':    return guard_(p, ['*'], function () { return apiRemoveLogo_(); });
    case 'setFiscalYear': return guard_(p, ['*'], function () { return apiSetFiscalYear_(p.fiscal_year); });

    // ---- ข้อมูลตั้งต้น (ประเภท / หน่วยนับ / ปีงบ) ----
    case 'getMasters':        return guard_(p, ['view'], function () { return apiGetMasters_(); });
    case 'saveCategory':      return guard_(p, ['*'], function () { return apiSaveCategory_(p.category); });
    case 'deleteCategory':    return guard_(p, ['*'], function () { return apiDeleteCategory_(p.id); });
    case 'reorderCategories': return guard_(p, ['*'], function () { return apiReorderCategories_(p.ids); });
    case 'saveUnit':          return guard_(p, ['*'], function () { return apiSaveUnit_(p.unit); });
    case 'deleteUnit':        return guard_(p, ['*'], function () { return apiDeleteUnit_(p.id); });

    // ---- ทะเบียนรายการ (รหัส/ชื่อ/หน่วยนับ บันทึกครั้งเดียว) ----
    case 'findProductByCode': return guard_(p, ['view'], function () { return apiFindProductByCode_(p.code); });
    case 'searchProducts':    return guard_(p, ['view'], function () { return apiSearchProducts_(p.q, p.category_id); });
    case 'getProducts':       return guard_(p, ['view'], function () { return apiGetProducts_(p.category_id); });
    case 'saveProduct':       return guard_(p, ['*'],    function () { return apiSaveProduct_(p.product); });
    case 'deleteProduct':     return guard_(p, ['*'],    function () { return apiDeleteProduct_(p.id); });

    // ---- แผนประจำปี ----
    case 'getPlanItems':   return guard_(p, ['view'], function ()  { return apiGetPlanItems_(p); });
    case 'savePlanItem':   return guard_(p, ['*'],    function (u) { return apiSavePlanItem_(p, u); });
    case 'deletePlanItem': return guard_(p, ['*'],    function ()  { return apiDeletePlanItem_(p.id); });

    // ---- ขออนุมัติซื้อ ----
    case 'getPurchases':   return guard_(p, ['view'],     function ()  { return apiGetPurchases_(p); });
    case 'savePurchase':   return guard_(p, ['purchase'], function (u) { return apiSavePurchase_(p, u); });
    case 'deletePurchase': return guard_(p, ['*'],        function ()  { return apiDeletePurchase_(p.id); });

    // ---- ผลตามแผน / แดชบอร์ด / รายงาน ----
    case 'getPlanResult': return guard_(p, ['view'], function () { return apiGetPlanResult_(p); });
    case 'getDashboard':  return guard_(p, ['view'], function () { return apiGetDashboard_(p); });
    case 'getReport':     return guard_(p, ['view'], function () { return apiGetReport_(p); });
    case 'exportData':    return guard_(p, ['view'], function () { return apiExportData_(p); });

    // ---- จัดการผู้ใช้ ----
    case 'getUsers':   return guard_(p, ['*'], function ()  { return apiGetUsers_(); });
    case 'saveUser':   return guard_(p, ['*'], function ()  { return apiSaveUser_(p.user); });
    case 'deleteUser': return guard_(p, ['*'], function (u) { return apiDeleteUser_(p.id, u); });

    default: return { status: 'error', message: 'ไม่รู้จัก action: ' + action };
  }
}

// ============================================================ AUTH
function apiLogin_(username, password) {
  ensureInit_();
  if (!username || !password) return { status: 'error', message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' };

  var u = findUserByUsername_(String(username).trim());
  if (!u || u.active === false) return { status: 'error', message: 'ไม่พบบัญชีผู้ใช้นี้' };
  if (String(u.password) !== String(password)) return { status: 'error', message: 'รหัสผ่านไม่ถูกต้อง' };

  var token = Utilities.getUuid();
  appendRecord_('Sessions', {
    id: token,
    username: u.username,
    role: roleKeyOf_(u),
    created_at: now_(),
    expires_at: new Date(Date.now() + CONFIG.SESSION_TIMEOUT).toISOString()
  });

  u.last_login = now_();
  updateRecord_('Users', u.id, u);

  return { status: 'success', token: token, user: publicUser_(u) };
}

function apiLogout_(token) {
  if (token) {
    var sh = getSheet_('Sessions');
    var rows = readAll_('Sessions');
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id === token) { sh.deleteRow(rows[i]._row); break; }
    }
  }
  return { status: 'success', message: 'ออกจากระบบแล้ว' };
}

function getSession_(token) {
  if (!token) return null;
  var rows = readAll_('Sessions');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === token) {
      if (new Date(rows[i].expires_at).getTime() < Date.now()) return null;
      return rows[i];
    }
  }
  return null;
}

function findUserByUsername_(username) {
  var users = readAll_('Users');
  for (var i = 0; i < users.length; i++) if (users[i].username === username) return users[i];
  return null;
}

/** บทบาทที่ระบบนี้รู้จัก - บทบาทเก่า (pharmacist/staff) ถูกมองเป็น user */
function roleKeyOf_(u) {
  return CONFIG.USER_ROLES[u.role] ? u.role : 'user';
}

function permsOf_(u) {
  if (u.permissions && u.permissions.indexOf('*') !== -1) return ['*'];
  return CONFIG.USER_ROLES[roleKeyOf_(u)].permissions;
}

function hasPerm_(user, perms) {
  var mine = permsOf_(user);
  if (mine.indexOf('*') !== -1) return true;
  for (var i = 0; i < perms.length; i++) {
    if (perms[i] === '*') continue;
    if (mine.indexOf(perms[i]) !== -1) return true;
  }
  return false;
}

function isAdmin_(user) { return permsOf_(user).indexOf('*') !== -1; }

/** หุ้มทุก action ที่ต้องล็อกอิน: ตรวจ session + สิทธิ์ */
function guard_(p, perms, fn) {
  var s = getSession_(p.token);
  if (!s) return { status: 'error', code: 'AUTH', message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' };
  var user = findUserByUsername_(s.username);
  if (!user || user.active === false) return { status: 'error', code: 'AUTH', message: 'บัญชีถูกปิดใช้งาน' };
  if (perms && perms.length && !hasPerm_(user, perms)) return { status: 'error', message: 'ไม่มีสิทธิ์ใช้งานส่วนนี้' };
  return fn(user);
}

function publicUser_(u) {
  var rk = roleKeyOf_(u);
  return {
    username: u.username,
    name: u.name || CONFIG.USER_ROLES[rk].name,
    role: rk,
    role_name: CONFIG.USER_ROLES[rk].name,
    permissions: permsOf_(u)
  };
}

function apiChangePassword_(p, user) {
  var oldP = String(p.old_password || '');
  var newP = String(p.new_password || '');
  if (String(user.password) !== oldP) return { status: 'error', message: 'รหัสผ่านเดิมไม่ถูกต้อง' };
  if (newP.length < 4) return { status: 'error', message: 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 4 ตัวอักษร' };
  user.password = newP;
  user.updated_at = now_();
  updateRecord_('Users', user.id, user);
  return { status: 'success', message: 'เปลี่ยนรหัสผ่านแล้ว' };
}

// ============================================================ CONFIG / BRANDING / LOGO
function apiBranding_() {
  ensureInit_();
  var c = readConfig_();
  return {
    status: 'success',
    branding: {
      hospital_name: c.hospital_name || CONFIG.HOSPITAL_NAME,
      logo_url: c.logo_file_id ? logoUrl_(c.logo_file_id) : '',
      app_name: CONFIG.APP_NAME,
      app_version: CONFIG.APP_VERSION,
      fiscal_year: fiscalYearOf_(c),
      display_be: c.display_be === undefined ? true : !!c.display_be
    }
  };
}

function apiGetConfig_() {
  var c = readConfig_();
  c.logo_url = c.logo_file_id ? logoUrl_(c.logo_file_id) : '';
  c.fiscal_year = fiscalYearOf_(c);
  return { status: 'success', config: c };
}

function apiSaveConfig_(patch) {
  var c = readConfig_();
  if (patch && typeof patch === 'object') {
    if (patch.hospital_name !== undefined) c.hospital_name = String(patch.hospital_name).trim();
    if (patch.display_be !== undefined) c.display_be = !!patch.display_be;
    if (patch.block_over_plan !== undefined) c.block_over_plan = !!patch.block_over_plan;
    if (patch.fiscal_year !== undefined) {
      var fy = normalizeFiscalYear_(patch.fiscal_year);
      if (!fy) return { status: 'error', message: 'ปีงบประมาณไม่ถูกต้อง' };
      c.fiscal_year = fy;
    }
  }
  c.updated_at = now_();
  writeConfig_(c);
  return {
    status: 'success',
    message: 'บันทึกการตั้งค่าแล้ว',
    config: { hospital_name: c.hospital_name, fiscal_year: fiscalYearOf_(c) }
  };
}

function apiSetFiscalYear_(year) {
  var fy = normalizeFiscalYear_(year);
  if (!fy) return { status: 'error', message: 'ปีงบประมาณไม่ถูกต้อง' };
  var c = readConfig_();
  c.fiscal_year = fy;
  c.updated_at = now_();
  writeConfig_(c);
  return { status: 'success', message: 'ตั้งปีงบประมาณเป็น พ.ศ. ' + fy + ' แล้ว', fiscal_year: fy };
}

function apiUploadLogo_(base64, filename) {
  if (!base64) return { status: 'error', message: 'ไม่พบไฟล์รูป' };
  var c = readConfig_();
  var folder = getFolder_(c);
  var dataPart = base64.indexOf(',') !== -1 ? base64.split(',').pop() : base64;
  var bytes = Utilities.base64Decode(dataPart);
  var blob = Utilities.newBlob(bytes, guessMime_(filename), filename || ('logo_' + Date.now() + '.png'));

  if (c.logo_file_id) { try { DriveApp.getFileById(c.logo_file_id).setTrashed(true); } catch (_) {} }

  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  c = readConfig_();
  c.logo_file_id = file.getId();
  c.updated_at = now_();
  writeConfig_(c);

  return { status: 'success', message: 'อัปโหลดโลโก้แล้ว', logo_url: logoUrl_(c.logo_file_id) };
}

function apiRemoveLogo_() {
  var c = readConfig_();
  if (c.logo_file_id) { try { DriveApp.getFileById(c.logo_file_id).setTrashed(true); } catch (_) {} }
  c.logo_file_id = '';
  c.updated_at = now_();
  writeConfig_(c);
  return { status: 'success', message: 'ลบโลโก้แล้ว' };
}

function logoUrl_(fileId) {
  // thumbnail endpoint hotlink ได้ดีกับ origin ภายนอก (GitHub Pages)
  return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w512';
}

function getFolder_(c) {
  if (c.folder_id) {
    try { return DriveApp.getFolderById(c.folder_id); } catch (_) {}
  }
  var folder = DriveApp.createFolder(CONFIG.FOLDER_NAME);
  var cur = readConfig_();
  cur.folder_id = folder.getId();
  writeConfig_(cur);
  return folder;
}

function guessMime_(name) {
  name = (name || '').toLowerCase();
  if (name.match(/\.png$/)) return 'image/png';
  if (name.match(/\.(jpg|jpeg)$/)) return 'image/jpeg';
  if (name.match(/\.webp$/)) return 'image/webp';
  if (name.match(/\.svg$/)) return 'image/svg+xml';
  return 'image/png';
}

function readConfig_() {
  var sh = getSheet_('Config');
  if (sh.getLastRow() < 2) sh.appendRow([JSON.stringify(defaultConfig_())]);
  var v = sh.getRange(2, 1).getValue();
  try { return JSON.parse(v); } catch (_) { return defaultConfig_(); }
}

function writeConfig_(c) {
  getSheet_('Config').getRange(2, 1).setValue(JSON.stringify(c));
}

function defaultConfig_() {
  return {
    hospital_name: CONFIG.HOSPITAL_NAME,
    logo_file_id: '',
    folder_id: '',
    fiscal_year: currentFiscalYear_(),
    display_be: true,
    block_over_plan: true,
    app_version: CONFIG.APP_VERSION,
    created_at: now_(),
    updated_at: now_()
  };
}

/** ปีงบประมาณไทย: เริ่ม 1 ต.ค. คืนค่าเป็น พ.ศ. */
function currentFiscalYear_() {
  var d = new Date();
  var fy = d.getFullYear() + 543;
  if (d.getMonth() >= 9) fy += 1; // ต.ค. เป็นต้นไป = ปีงบถัดไป
  return fy;
}

function fiscalYearOf_(c) {
  return normalizeFiscalYear_(c && c.fiscal_year) || currentFiscalYear_();
}

/** รับได้ทั้ง พ.ศ. และ ค.ศ. คืนค่าเป็น พ.ศ. เสมอ (0 = ไม่ถูกต้อง) */
function normalizeFiscalYear_(y) {
  var n = parseInt(y, 10);
  if (!n || isNaN(n)) return 0;
  if (n >= 1900 && n <= 2200) n += 543;
  if (n < 2400 || n > 2700) return 0;
  return n;
}

// ============================================================ INIT / SEED
function setup() {
  var r = initializeSheets();
  Logger.log(r.message);
  Logger.log('ติดตั้งเสร็จ ทำขั้นตอน Deploy ต่อได้เลย');
  return r;
}

function ensureInit_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName('Config') || !ss.getSheetByName('Users') || !ss.getSheetByName('Categories')) {
    initializeSheets();
  }
}

function initializeSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var names = ss.getSheets().map(function (s) { return s.getName(); });

  Object.keys(CONFIG.SHEET_KEYS).forEach(function (sheetName) {
    if (names.indexOf(sheetName) === -1) {
      var sh = ss.insertSheet(sheetName);
      sh.appendRow([CONFIG.SHEET_KEYS[sheetName]]);
    }
  });

  // Config (แถวเดียว) - ถ้ามีของเดิมอยู่แล้วจะเติมเฉพาะคีย์ที่ขาด ไม่ลบของเดิม
  var cfgSheet = ss.getSheetByName('Config');
  if (cfgSheet.getLastRow() < 2) {
    cfgSheet.appendRow([JSON.stringify(defaultConfig_())]);
  } else {
    var c = readConfig_();
    var def = defaultConfig_();
    var touched = false;
    ['hospital_name', 'fiscal_year', 'display_be', 'block_over_plan'].forEach(function (k) {
      if (c[k] === undefined) { c[k] = def[k]; touched = true; }
    });
    if (touched) writeConfig_(c);
  }

  if (ss.getSheetByName('Categories').getLastRow() < 2) seedCategories_();
  if (ss.getSheetByName('Units').getLastRow() < 2) seedUnits_();

  var userSheet = ss.getSheetByName('Users');
  if (userSheet.getLastRow() < 2) seedUsers_(userSheet);

  return { status: 'success', message: 'สร้าง sheets ของระบบแผนจัดซื้อเรียบร้อยแล้ว' };
}

function seedCategories_() {
  var sh = getSheet_('Categories');
  CONFIG.DEFAULT_CATEGORIES.forEach(function (row, idx) {
    sh.appendRow([JSON.stringify({
      id: Utilities.getUuid(),
      name: row[0],
      icon: row[1],
      color: row[2],
      sort_order: idx + 1,
      active: true,
      created_at: now_(),
      updated_at: now_()
    })]);
  });
}

function seedUnits_() {
  var sh = getSheet_('Units');
  CONFIG.DEFAULT_UNITS.forEach(function (name, idx) {
    sh.appendRow([JSON.stringify({
      id: Utilities.getUuid(),
      name: name,
      sort_order: idx + 1,
      active: true,
      created_at: now_()
    })]);
  });
}

function seedUsers_(sheet) {
  Object.keys(CONFIG.ADMIN_USERS).forEach(function (username) {
    var roleKey = CONFIG.USER_ROLES[username] ? username : 'admin';
    sheet.appendRow([JSON.stringify({
      id: Utilities.getUuid(),
      username: username,
      password: CONFIG.ADMIN_USERS[username],
      role: roleKey,
      name: CONFIG.USER_ROLES[roleKey].name,
      permissions: CONFIG.USER_ROLES[roleKey].permissions,
      active: true,
      last_login: '',
      created_at: now_(),
      updated_at: now_()
    })]);
  });
}

// ============================================================ SHEET HELPERS (JSON-per-row)
function getSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow([CONFIG.SHEET_KEYS[name] || (name.toLowerCase() + '_json')]);
  }
  return sh;
}

function readAll_(name) {
  var sh = getSheet_(name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, 1).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var cell = vals[i][0];
    if (!cell) continue;
    try {
      var o = JSON.parse(cell);
      o._row = i + 2;
      out.push(o);
    } catch (e) { /* ข้ามแถวเสีย */ }
  }
  return out;
}

function appendRecord_(name, obj) {
  getSheet_(name).appendRow([JSON.stringify(stripMeta_(obj))]);
  return obj;
}

function updateRecord_(name, id, obj) {
  var sh = getSheet_(name);
  var rows = readAll_(name);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id) {
      sh.getRange(rows[i]._row, 1).setValue(JSON.stringify(stripMeta_(obj)));
      return obj;
    }
  }
  return null;
}

function deleteRecord_(name, id) {
  var sh = getSheet_(name);
  var rows = readAll_(name);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id) { sh.deleteRow(rows[i]._row); return true; }
  }
  return false;
}

function findById_(name, id) {
  var rows = readAll_(name);
  for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i];
  return null;
}

function stripMeta_(obj) {
  var clean = {};
  Object.keys(obj).forEach(function (k) { if (k !== '_row') clean[k] = obj[k]; });
  return clean;
}

function activeOnly_(x) { return x.active !== false; }
function bySortOrder_(a, b) { return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0); }

// ============================================================ MASTERS: ประเภทแผน / หน่วยนับ
function apiGetMasters_() {
  ensureInit_();
  var c = readConfig_();
  var cats = readAll_('Categories').filter(activeOnly_).sort(bySortOrder_).map(stripMeta_);
  var units = readAll_('Units').filter(activeOnly_).sort(bySortOrder_).map(stripMeta_);
  return {
    status: 'success',
    categories: cats,
    units: units,
    fiscal_year: fiscalYearOf_(c),
    years: fiscalYearList_(c),
    block_over_plan: c.block_over_plan !== false
  };
}

/** ปีงบที่มีข้อมูลจริง + ปีปัจจุบัน + ปีที่ตั้งไว้ เรียงจากใหม่ไปเก่า */
function fiscalYearList_(c) {
  var set = {};
  set[fiscalYearOf_(c)] = true;
  set[currentFiscalYear_()] = true;
  readAll_('Plans').forEach(function (r) { var y = normalizeFiscalYear_(r.fiscal_year); if (y) set[y] = true; });
  readAll_('Purchases').forEach(function (r) { var y = normalizeFiscalYear_(r.fiscal_year); if (y) set[y] = true; });
  return Object.keys(set).map(Number).sort(function (a, b) { return b - a; });
}

function apiSaveCategory_(cat) {
  if (!cat || !String(cat.name || '').trim()) return { status: 'error', message: 'กรุณากรอกชื่อประเภทแผน' };
  var name = String(cat.name).trim();
  var all = readAll_('Categories');

  for (var i = 0; i < all.length; i++) {
    if (all[i].name === name && all[i].id !== cat.id && all[i].active !== false) {
      return { status: 'error', message: 'มีประเภทแผนชื่อนี้อยู่แล้ว' };
    }
  }

  if (cat.id) {
    var ex = findById_('Categories', cat.id);
    if (!ex) return { status: 'error', message: 'ไม่พบประเภทแผน' };
    ex.name = name;
    if (cat.icon) ex.icon = String(cat.icon);
    if (cat.color) ex.color = String(cat.color);
    if (cat.active !== undefined) ex.active = !!cat.active;
    ex.updated_at = now_();
    updateRecord_('Categories', cat.id, ex);
    return { status: 'success', message: 'บันทึกประเภทแผนแล้ว', id: cat.id };
  }

  var maxOrder = 0;
  all.forEach(function (x) { maxOrder = Math.max(maxOrder, Number(x.sort_order) || 0); });
  var rec = {
    id: Utilities.getUuid(),
    name: name,
    icon: cat.icon || 'box',
    color: cat.color || '#6D3FD6',
    sort_order: maxOrder + 1,
    active: true,
    created_at: now_(),
    updated_at: now_()
  };
  appendRecord_('Categories', rec);
  return { status: 'success', message: 'เพิ่มประเภทแผนแล้ว', id: rec.id };
}

function apiDeleteCategory_(id) {
  var ex = findById_('Categories', id);
  if (!ex) return { status: 'error', message: 'ไม่พบประเภทแผน' };

  var used = readAll_('Plans').filter(function (r) { return r.category_id === id && r.active !== false; }).length;
  if (used) return { status: 'error', message: 'ลบไม่ได้ มีรายการในแผนใช้ประเภทนี้อยู่ ' + used + ' รายการ' };

  deleteRecord_('Categories', id);
  return { status: 'success', message: 'ลบประเภทแผนแล้ว' };
}

function apiReorderCategories_(ids) {
  if (!ids || !ids.length) return { status: 'error', message: 'ไม่มีข้อมูลลำดับ' };
  ids.forEach(function (id, idx) {
    var ex = findById_('Categories', id);
    if (ex) { ex.sort_order = idx + 1; ex.updated_at = now_(); updateRecord_('Categories', id, ex); }
  });
  return { status: 'success', message: 'จัดลำดับแล้ว' };
}

function apiSaveUnit_(unit) {
  if (!unit || !String(unit.name || '').trim()) return { status: 'error', message: 'กรุณากรอกชื่อหน่วยนับ' };
  var name = String(unit.name).trim();
  var all = readAll_('Units');
  for (var i = 0; i < all.length; i++) {
    if (all[i].name === name && all[i].id !== unit.id) return { status: 'error', message: 'มีหน่วยนับนี้อยู่แล้ว' };
  }

  if (unit.id) {
    var ex = findById_('Units', unit.id);
    if (!ex) return { status: 'error', message: 'ไม่พบหน่วยนับ' };
    ex.name = name; ex.updated_at = now_();
    updateRecord_('Units', unit.id, ex);
    return { status: 'success', message: 'บันทึกหน่วยนับแล้ว' };
  }

  var maxOrder = 0;
  all.forEach(function (x) { maxOrder = Math.max(maxOrder, Number(x.sort_order) || 0); });
  appendRecord_('Units', {
    id: Utilities.getUuid(), name: name, sort_order: maxOrder + 1, active: true, created_at: now_()
  });
  return { status: 'success', message: 'เพิ่มหน่วยนับแล้ว' };
}

function apiDeleteUnit_(id) {
  var ex = findById_('Units', id);
  if (!ex) return { status: 'error', message: 'ไม่พบหน่วยนับ' };
  deleteRecord_('Units', id);
  return { status: 'success', message: 'ลบหน่วยนับแล้ว' };
}

// ============================================================ PRODUCTS (ทะเบียนรายการ)
/* "ช่องสีแดง" = รหัสรายการ / ชื่อ / หน่วยนับ  บันทึกครั้งแรกครั้งเดียว
   ครั้งต่อไปใส่รหัสแล้วดึงชื่อ+หน่วยนับขึ้นมาอัตโนมัติ */

function normCode_(code) { return String(code == null ? '' : code).trim(); }
function codeKey_(code) { return normCode_(code).toUpperCase(); }

function findProductByCode_(code) {
  var key = codeKey_(code);
  if (!key) return null;
  var all = readAll_('Products');
  for (var i = 0; i < all.length; i++) {
    if (codeKey_(all[i].code) === key) return all[i];
  }
  return null;
}

function apiFindProductByCode_(code) {
  var p = findProductByCode_(code);
  if (!p) return { status: 'success', found: false, data: null };
  return { status: 'success', found: true, data: stripMeta_(p) };
}

function apiSearchProducts_(q, categoryId) {
  var s = String(q || '').trim().toLowerCase();
  var all = readAll_('Products').filter(activeOnly_);
  if (categoryId) all = all.filter(function (p) { return !p.category_id || p.category_id === categoryId; });
  if (s) {
    all = all.filter(function (p) {
      return String(p.code || '').toLowerCase().indexOf(s) !== -1 ||
             String(p.name || '').toLowerCase().indexOf(s) !== -1;
    });
  }
  all.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'th'); });
  return { status: 'success', data: all.slice(0, 40).map(stripMeta_) };
}

function apiGetProducts_(categoryId) {
  var all = readAll_('Products').filter(activeOnly_);
  if (categoryId) all = all.filter(function (p) { return p.category_id === categoryId; });
  all.sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); });
  return { status: 'success', data: all.map(stripMeta_) };
}

function apiSaveProduct_(prod) {
  if (!prod) return { status: 'error', message: 'ไม่มีข้อมูล' };
  var code = normCode_(prod.code);
  var name = String(prod.name || '').trim();
  var unit = String(prod.unit || '').trim();
  if (!code) return { status: 'error', message: 'กรุณากรอกรหัสรายการ' };
  if (!name) return { status: 'error', message: 'กรุณากรอกชื่อรายการ' };
  if (!unit) return { status: 'error', message: 'กรุณาเลือกหน่วยนับ' };

  var dup = findProductByCode_(code);
  if (dup && dup.id !== prod.id) return { status: 'error', message: 'มีรหัสรายการนี้อยู่แล้ว (' + dup.name + ')' };

  if (prod.id) {
    var ex = findById_('Products', prod.id);
    if (!ex) return { status: 'error', message: 'ไม่พบรายการ' };
    ex.code = code; ex.name = name; ex.unit = unit;
    if (prod.category_id !== undefined) ex.category_id = prod.category_id || '';
    ex.updated_at = now_();
    updateRecord_('Products', prod.id, ex);
    syncProductRefs_(ex);
    return { status: 'success', message: 'บันทึกรายการแล้ว', data: stripMeta_(ex) };
  }

  var rec = {
    id: Utilities.getUuid(),
    code: code, name: name, unit: unit,
    category_id: prod.category_id || '',
    active: true,
    created_at: now_(), updated_at: now_()
  };
  appendRecord_('Products', rec);
  return { status: 'success', message: 'เพิ่มรายการแล้ว', data: rec };
}

function apiDeleteProduct_(id) {
  var ex = findById_('Products', id);
  if (!ex) return { status: 'error', message: 'ไม่พบรายการ' };
  var used = readAll_('Plans').filter(function (r) { return r.product_id === id; }).length;
  if (used) return { status: 'error', message: 'ลบไม่ได้ มีรายการนี้อยู่ในแผน ' + used + ' รายการ' };
  deleteRecord_('Products', id);
  return { status: 'success', message: 'ลบรายการแล้ว' };
}

/** แก้ชื่อ/หน่วยนับที่ทะเบียนกลาง แล้วอัปเดตให้แถวแผน/ขอซื้อที่อ้างถึงตรงกัน */
function syncProductRefs_(prod) {
  ['Plans', 'Purchases'].forEach(function (sheetName) {
    readAll_(sheetName).forEach(function (r) {
      if (r.product_id !== prod.id) return;
      if (r.code === prod.code && r.name === prod.name && r.unit === prod.unit) return;
      r.code = prod.code; r.name = prod.name; r.unit = prod.unit;
      r.updated_at = now_();
      updateRecord_(sheetName, r.id, r);
    });
  });
}

/** หาในทะเบียน ถ้าไม่มีก็สร้าง (บันทึกครั้งแรกครั้งเดียว) */
function upsertProduct_(code, name, unit, categoryId) {
  var ex = findProductByCode_(code);
  if (ex) {
    var changed = false;
    if (name && ex.name !== name) { ex.name = name; changed = true; }
    if (unit && ex.unit !== unit) { ex.unit = unit; changed = true; }
    if (categoryId && !ex.category_id) { ex.category_id = categoryId; changed = true; }
    if (changed) { ex.updated_at = now_(); updateRecord_('Products', ex.id, ex); }
    return ex;
  }
  var rec = {
    id: Utilities.getUuid(),
    code: normCode_(code), name: name, unit: unit,
    category_id: categoryId || '',
    active: true,
    created_at: now_(), updated_at: now_()
  };
  appendRecord_('Products', rec);
  return rec;
}

// ============================================================ แผนประจำปี (Plans)
function categoryMap_() {
  var m = {};
  readAll_('Categories').forEach(function (c) { m[c.id] = c; });
  return m;
}

function apiGetPlanItems_(p) {
  var fy = normalizeFiscalYear_(p.fiscal_year) || fiscalYearOf_(readConfig_());
  var catId = p.category_id || '';
  var q = String(p.q || '').trim().toLowerCase();
  var cats = categoryMap_();

  var used = purchaseTotalsByPlan_(fy);
  var rows = readAll_('Plans')
    .filter(activeOnly_)
    .filter(function (r) { return normalizeFiscalYear_(r.fiscal_year) === fy; })
    .filter(function (r) { return !catId || r.category_id === catId; })
    .filter(function (r) {
      if (!q) return true;
      return String(r.code || '').toLowerCase().indexOf(q) !== -1 ||
             String(r.name || '').toLowerCase().indexOf(q) !== -1;
    })
    .map(function (r) { return decoratePlanRow_(r, used, cats); });

  rows.sort(function (a, b) {
    if (a.category_order !== b.category_order) return a.category_order - b.category_order;
    return String(a.code).localeCompare(String(b.code));
  });

  return { status: 'success', fiscal_year: fy, data: rows, total: sumPlan_(rows) };
}

function decoratePlanRow_(r, usedMap, cats) {
  var cat = cats[r.category_id] || {};
  var u = usedMap[r.id] || { qty: 0, amount: 0, count: 0 };
  var qtyPlan = num_(r.qty_plan), amtPlan = num_(r.amount_plan);
  return {
    id: r.id,
    fiscal_year: normalizeFiscalYear_(r.fiscal_year),
    category_id: r.category_id,
    category_name: cat.name || 'ไม่ระบุประเภท',
    category_color: cat.color || '#6D3FD6',
    category_icon: cat.icon || 'box',
    category_order: Number(cat.sort_order) || 999,
    product_id: r.product_id || '',
    code: r.code || '',
    name: r.name || '',
    unit: r.unit || '',
    qty_plan: qtyPlan,
    amount_plan: amtPlan,
    used_qty: u.qty,
    used_amount: u.amount,
    purchase_count: u.count,
    remain_qty: round2_(qtyPlan - u.qty),
    remain_amount: round2_(amtPlan - u.amount),
    pct: amtPlan > 0 ? Math.min(100, round2_(u.amount * 100 / amtPlan)) : 0,
    note: r.note || '',
    created_at: r.created_at || ''
  };
}

function sumPlan_(rows) {
  var t = { items: rows.length, qty_plan: 0, amount_plan: 0, used_qty: 0, used_amount: 0, remain_qty: 0, remain_amount: 0 };
  rows.forEach(function (r) {
    t.qty_plan += r.qty_plan; t.amount_plan += r.amount_plan;
    t.used_qty += r.used_qty; t.used_amount += r.used_amount;
  });
  t.qty_plan = round2_(t.qty_plan); t.amount_plan = round2_(t.amount_plan);
  t.used_qty = round2_(t.used_qty); t.used_amount = round2_(t.used_amount);
  t.remain_qty = round2_(t.qty_plan - t.used_qty);
  t.remain_amount = round2_(t.amount_plan - t.used_amount);
  t.pct = t.amount_plan > 0 ? Math.min(100, round2_(t.used_amount * 100 / t.amount_plan)) : 0;
  return t;
}

/** รวมยอดขอซื้อของปีงบนั้น จัดกลุ่มตาม plan_id */
function purchaseTotalsByPlan_(fy) {
  var map = {};
  readAll_('Purchases')
    .filter(activeOnly_)
    .filter(function (r) { return normalizeFiscalYear_(r.fiscal_year) === fy; })
    .forEach(function (r) {
      var k = r.plan_id || '';
      if (!map[k]) map[k] = { qty: 0, amount: 0, count: 0 };
      map[k].qty += num_(r.qty);
      map[k].amount += num_(r.amount);
      map[k].count += 1;
    });
  Object.keys(map).forEach(function (k) {
    map[k].qty = round2_(map[k].qty);
    map[k].amount = round2_(map[k].amount);
  });
  return map;
}

function findPlanRow_(fy, categoryId, code) {
  var key = codeKey_(code);
  var rows = readAll_('Plans').filter(activeOnly_);
  for (var i = 0; i < rows.length; i++) {
    if (normalizeFiscalYear_(rows[i].fiscal_year) === fy &&
        rows[i].category_id === categoryId &&
        codeKey_(rows[i].code) === key) return rows[i];
  }
  return null;
}

function apiSavePlanItem_(p, user) {
  var it = p.item || {};
  var fy = normalizeFiscalYear_(it.fiscal_year || p.fiscal_year) || fiscalYearOf_(readConfig_());
  var catId = String(it.category_id || '').trim();
  var code = normCode_(it.code);
  var name = String(it.name || '').trim();
  var unit = String(it.unit || '').trim();
  var qty = num_(it.qty_plan);
  var amount = num_(it.amount_plan);

  if (!catId) return { status: 'error', message: 'กรุณาเลือกประเภทแผน', field: 'category_id' };
  if (!findById_('Categories', catId)) return { status: 'error', message: 'ไม่พบประเภทแผนนี้', field: 'category_id' };
  if (!code) return { status: 'error', message: 'กรุณากรอกรหัสรายการ', field: 'code' };
  if (!name) return { status: 'error', message: 'กรุณากรอกชื่อรายการ', field: 'name' };
  if (!unit) return { status: 'error', message: 'กรุณาเลือกหน่วยนับ', field: 'unit' };
  if (qty <= 0) return { status: 'error', message: 'จำนวนที่ได้รับอนุมัติตามแผนต้องมากกว่า 0', field: 'qty_plan' };
  if (amount <= 0) return { status: 'error', message: 'วงเงินที่ได้รับอนุมัติตามแผนต้องมากกว่า 0', field: 'amount_plan' };

  var prod = upsertProduct_(code, name, unit, catId);

  if (it.id) {
    var ex = findById_('Plans', it.id);
    if (!ex) return { status: 'error', message: 'ไม่พบรายการในแผน' };

    var dupE = findPlanRow_(fy, catId, code);
    if (dupE && dupE.id !== ex.id) return { status: 'error', code: 'DUP', dup_id: dupE.id, message: 'มีรหัสรายการนี้ในแผนปีนี้แล้ว' };

    // กันแก้แผนให้ต่ำกว่ายอดที่ขอซื้อไปแล้ว
    var used = purchaseTotalsByPlan_(fy)[ex.id] || { qty: 0, amount: 0 };
    if (qty < used.qty) return { status: 'error', message: 'ลดจำนวนแผนต่ำกว่ายอดที่ขอซื้อไปแล้ว (' + fmtNum_(used.qty) + ') ไม่ได้', field: 'qty_plan' };
    if (amount < used.amount) return { status: 'error', message: 'ลดวงเงินแผนต่ำกว่ายอดที่ขอซื้อไปแล้ว (' + fmtNum_(used.amount) + ' บาท) ไม่ได้', field: 'amount_plan' };

    ex.fiscal_year = fy; ex.category_id = catId;
    ex.product_id = prod.id; ex.code = code; ex.name = name; ex.unit = unit;
    ex.qty_plan = qty; ex.amount_plan = amount;
    ex.note = String(it.note || '').trim();
    ex.updated_at = now_(); ex.updated_by = user.username;
    updateRecord_('Plans', it.id, ex);
    return { status: 'success', message: 'บันทึกรายการในแผนแล้ว', id: ex.id };
  }

  var dup = findPlanRow_(fy, catId, code);
  if (dup) {
    return {
      status: 'error', code: 'DUP', dup_id: dup.id,
      message: 'มีรหัส ' + code + ' ในแผนประเภทนี้ของปี ' + fy + ' แล้ว'
    };
  }

  var rec = {
    id: Utilities.getUuid(),
    fiscal_year: fy,
    category_id: catId,
    product_id: prod.id,
    code: code, name: name, unit: unit,
    qty_plan: qty, amount_plan: amount,
    note: String(it.note || '').trim(),
    active: true,
    created_at: now_(), created_by: user.username,
    updated_at: now_()
  };
  appendRecord_('Plans', rec);
  return { status: 'success', message: 'เพิ่มรายการในแผนแล้ว', id: rec.id };
}

function apiDeletePlanItem_(id) {
  var ex = findById_('Plans', id);
  if (!ex) return { status: 'error', message: 'ไม่พบรายการในแผน' };
  var used = readAll_('Purchases').filter(activeOnly_).filter(function (r) { return r.plan_id === id; }).length;
  if (used) return { status: 'error', message: 'ลบไม่ได้ มีใบขออนุมัติซื้ออ้างถึงรายการนี้ ' + used + ' รายการ' };
  deleteRecord_('Plans', id);
  return { status: 'success', message: 'ลบรายการในแผนแล้ว' };
}

// ============================================================ ขออนุมัติซื้อ (Purchases)
function apiGetPurchases_(p) {
  var fy = normalizeFiscalYear_(p.fiscal_year) || fiscalYearOf_(readConfig_());
  var catId = p.category_id || '';
  var planId = p.plan_id || '';
  var q = String(p.q || '').trim().toLowerCase();
  var limit = Number(p.limit) || 200;
  var cats = categoryMap_();

  // ระบุช่วงวันที่มา = กรองด้วยวันที่ขอซื้อล้วน ๆ (ไม่ผูกกับปีงบ ป้องกันผลลัพธ์ว่างโดยไม่รู้ตัว)
  var from = String(p.from || '').slice(0, 10);
  var to = String(p.to || '').slice(0, 10);
  var byDate = !!(from || to);

  var rows = readAll_('Purchases')
    .filter(activeOnly_)
    .filter(function (r) {
      if (!byDate) return normalizeFiscalYear_(r.fiscal_year) === fy;
      var d = String(r.date || '').slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    })
    .filter(function (r) { return !catId || r.category_id === catId; })
    .filter(function (r) { return !planId || r.plan_id === planId; })
    .filter(function (r) {
      if (!q) return true;
      return String(r.code || '').toLowerCase().indexOf(q) !== -1 ||
             String(r.name || '').toLowerCase().indexOf(q) !== -1 ||
             String(r.vendor || '').toLowerCase().indexOf(q) !== -1;
    });

  rows.sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });

  var out = rows.slice(0, limit).map(function (r) {
    var cat = cats[r.category_id] || {};
    return {
      id: r.id,
      fiscal_year: normalizeFiscalYear_(r.fiscal_year),
      plan_id: r.plan_id || '',
      category_id: r.category_id,
      category_name: cat.name || 'ไม่ระบุประเภท',
      category_color: cat.color || '#6D3FD6',
      code: r.code || '', name: r.name || '', unit: r.unit || '',
      qty: num_(r.qty), unit_price: num_(r.unit_price), amount: num_(r.amount),
      vendor: r.vendor || '', doc_no: r.doc_no || '', date: r.date || '',
      note: r.note || '', over_plan: !!r.over_plan,
      by: r.created_by || '', created_at: r.created_at || ''
    };
  });

  var total = { count: rows.length, qty: 0, amount: 0 };
  rows.forEach(function (r) { total.qty += num_(r.qty); total.amount += num_(r.amount); });
  total.qty = round2_(total.qty); total.amount = round2_(total.amount);

  return { status: 'success', fiscal_year: fy, from: from, to: to, by_date: byDate, data: out, total: total };
}

/** สรุปใบขออนุมัติซื้อรายประเภทแผน: กี่รายการ เป็นเงินเท่าไร */
function summarizePurchasesByCategory_(rows) {
  var cats = categoryMap_();
  var map = {};
  rows.forEach(function (r) {
    var b = map[r.category_id];
    if (!b) {
      var c = cats[r.category_id] || {};
      b = map[r.category_id] = {
        id: r.category_id,
        name: r.category_name || c.name || 'ไม่ระบุประเภท',
        color: r.category_color || c.color || '#6D3FD6',
        icon: c.icon || 'box',
        sort_order: Number(c.sort_order) || 999,
        count: 0, qty: 0, amount: 0, over_count: 0
      };
    }
    b.count += 1;
    b.qty += num_(r.qty);
    b.amount += num_(r.amount);
    if (r.over_plan) b.over_count += 1;
  });

  return Object.keys(map).map(function (k) {
    map[k].qty = round2_(map[k].qty);
    map[k].amount = round2_(map[k].amount);
    return map[k];
  }).sort(function (a, b) { return a.sort_order - b.sort_order; });
}

function apiSavePurchase_(p, user) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (e) {
    return { status: 'error', message: 'ระบบกำลังทำงานอยู่ ลองใหม่อีกครั้ง' };
  }

  try {
    var it = p.item || {};
    var cfg = readConfig_();
    var fy = normalizeFiscalYear_(it.fiscal_year || p.fiscal_year) || fiscalYearOf_(cfg);
    var catId = String(it.category_id || '').trim();
    var code = normCode_(it.code);
    var qty = num_(it.qty);
    var price = num_(it.unit_price);
    var amount = it.amount === undefined || it.amount === '' ? round2_(qty * price) : num_(it.amount);
    var vendor = String(it.vendor || '').trim();

    if (!catId) return { status: 'error', message: 'กรุณาเลือกประเภทแผน', field: 'category_id' };
    if (!code) return { status: 'error', message: 'กรุณากรอกรหัสรายการ', field: 'code' };
    if (qty <= 0) return { status: 'error', message: 'จำนวนที่ขอซื้อต้องมากกว่า 0', field: 'qty' };
    if (price <= 0) return { status: 'error', message: 'ราคาต่อหน่วยต้องมากกว่า 0', field: 'unit_price' };
    if (amount <= 0) return { status: 'error', message: 'วงเงินที่ขอซื้อต้องมากกว่า 0', field: 'amount' };
    if (!vendor) return { status: 'error', message: 'กรุณากรอกชื่อผู้ขาย', field: 'vendor' };

    var plan = findPlanRow_(fy, catId, code);
    if (!plan) {
      return {
        status: 'error', code: 'NOPLAN',
        message: 'ไม่พบรหัส ' + code + ' ในแผนประเภทนี้ของปีงบ ' + fy + ' กรุณาบันทึกในหน้าแผนประจำปีก่อน'
      };
    }

    var editingId = it.id || '';
    var used = { qty: 0, amount: 0 };
    readAll_('Purchases').filter(activeOnly_).forEach(function (r) {
      if (r.plan_id !== plan.id) return;
      if (editingId && r.id === editingId) return; // ไม่นับแถวที่กำลังแก้
      used.qty += num_(r.qty); used.amount += num_(r.amount);
    });

    var remainQty = round2_(num_(plan.qty_plan) - used.qty);
    var remainAmt = round2_(num_(plan.amount_plan) - used.amount);
    var overQty = qty > remainQty;
    var overAmt = amount > remainAmt;

    if (overQty || overAmt) {
      var blockOver = cfg.block_over_plan !== false;
      var allowed = !blockOver || (p.over_ok === true && isAdmin_(user));
      if (!allowed) {
        var msg = [];
        if (overQty) msg.push('จำนวนเกินแผน (คงเหลือ ' + fmtNum_(remainQty) + ' ' + (plan.unit || '') + ')');
        if (overAmt) msg.push('วงเงินเกินแผน (คงเหลือ ' + fmtNum_(remainAmt) + ' บาท)');
        return {
          status: 'error', code: 'OVER',
          can_override: isAdmin_(user),
          remain_qty: remainQty, remain_amount: remainAmt,
          message: msg.join(' · ')
        };
      }
    }

    var prod = upsertProduct_(code, plan.name, plan.unit, catId);

    if (editingId) {
      var ex = findById_('Purchases', editingId);
      if (!ex) return { status: 'error', message: 'ไม่พบใบขออนุมัติซื้อ' };
      ex.fiscal_year = fy; ex.plan_id = plan.id; ex.category_id = catId;
      ex.product_id = prod.id; ex.code = plan.code; ex.name = plan.name; ex.unit = plan.unit;
      ex.qty = qty; ex.unit_price = price; ex.amount = round2_(amount);
      ex.vendor = vendor;
      ex.doc_no = String(it.doc_no || '').trim();
      ex.date = String(it.date || '').trim() || ex.date;
      ex.note = String(it.note || '').trim();
      ex.over_plan = overQty || overAmt;
      ex.updated_at = now_(); ex.updated_by = user.username;
      updateRecord_('Purchases', editingId, ex);
      return { status: 'success', message: 'บันทึกการขออนุมัติซื้อแล้ว', id: ex.id, remain_qty: round2_(remainQty - qty), remain_amount: round2_(remainAmt - amount) };
    }

    var rec = {
      id: Utilities.getUuid(),
      fiscal_year: fy,
      plan_id: plan.id,
      category_id: catId,
      product_id: prod.id,
      code: plan.code, name: plan.name, unit: plan.unit,
      qty: qty, unit_price: price, amount: round2_(amount),
      vendor: vendor,
      doc_no: String(it.doc_no || '').trim(),
      date: String(it.date || '').trim() || todayIso_(),
      note: String(it.note || '').trim(),
      over_plan: overQty || overAmt,
      active: true,
      created_at: now_(), created_by: user.username,
      updated_at: now_()
    };
    appendRecord_('Purchases', rec);

    return {
      status: 'success',
      message: 'บันทึกการขออนุมัติซื้อแล้ว',
      id: rec.id,
      plan_name: plan.name,
      remain_qty: round2_(remainQty - qty),
      remain_amount: round2_(remainAmt - amount)
    };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function apiDeletePurchase_(id) {
  var ex = findById_('Purchases', id);
  if (!ex) return { status: 'error', message: 'ไม่พบใบขออนุมัติซื้อ' };
  deleteRecord_('Purchases', id);
  return { status: 'success', message: 'ลบรายการขออนุมัติซื้อแล้ว (คืนยอดเข้าแผนแล้ว)' };
}

// ============================================================ ผลตามแผน
function apiGetPlanResult_(p) {
  var fy = normalizeFiscalYear_(p.fiscal_year) || fiscalYearOf_(readConfig_());
  var catId = p.category_id || '';
  var cats = categoryMap_();
  var used = purchaseTotalsByPlan_(fy);

  var rows = readAll_('Plans')
    .filter(activeOnly_)
    .filter(function (r) { return normalizeFiscalYear_(r.fiscal_year) === fy; })
    .filter(function (r) { return !catId || r.category_id === catId; })
    .map(function (r) { return decoratePlanRow_(r, used, cats); });

  rows.sort(function (a, b) {
    if (a.category_order !== b.category_order) return a.category_order - b.category_order;
    return String(a.code).localeCompare(String(b.code));
  });

  return { status: 'success', fiscal_year: fy, category_id: catId, data: rows, total: sumPlan_(rows) };
}

// ============================================================ แดชบอร์ด
function apiGetDashboard_(p) {
  var cfg = readConfig_();
  var fy = normalizeFiscalYear_(p && p.fiscal_year) || fiscalYearOf_(cfg);
  var cats = readAll_('Categories').filter(activeOnly_).sort(bySortOrder_);
  var used = purchaseTotalsByPlan_(fy);

  var plans = readAll_('Plans')
    .filter(activeOnly_)
    .filter(function (r) { return normalizeFiscalYear_(r.fiscal_year) === fy; });

  var byCat = {};
  cats.forEach(function (c) {
    byCat[c.id] = {
      id: c.id, name: c.name, color: c.color || '#6D3FD6', icon: c.icon || 'box',
      sort_order: Number(c.sort_order) || 999,
      items: 0, amount_plan: 0, used_amount: 0, remain_amount: 0, purchase_count: 0, pct: 0
    };
  });

  var total = { items: 0, amount_plan: 0, used_amount: 0, remain_amount: 0, purchase_count: 0, over_items: 0 };

  plans.forEach(function (r) {
    var b = byCat[r.category_id];
    if (!b) {
      b = byCat[r.category_id] = {
        id: r.category_id, name: 'ไม่ระบุประเภท', color: '#64748B', icon: 'box',
        sort_order: 999, items: 0, amount_plan: 0, used_amount: 0, remain_amount: 0, purchase_count: 0, pct: 0
      };
    }
    var u = used[r.id] || { qty: 0, amount: 0, count: 0 };
    b.items += 1;
    b.amount_plan += num_(r.amount_plan);
    b.used_amount += u.amount;
    b.purchase_count += u.count;

    total.items += 1;
    total.amount_plan += num_(r.amount_plan);
    total.used_amount += u.amount;
    total.purchase_count += u.count;
    if (u.amount > num_(r.amount_plan) || u.qty > num_(r.qty_plan)) total.over_items += 1;
  });

  var list = Object.keys(byCat).map(function (k) {
    var b = byCat[k];
    b.amount_plan = round2_(b.amount_plan);
    b.used_amount = round2_(b.used_amount);
    b.remain_amount = round2_(b.amount_plan - b.used_amount);
    b.pct = b.amount_plan > 0 ? Math.min(100, round2_(b.used_amount * 100 / b.amount_plan)) : 0;
    return b;
  }).sort(function (a, b) { return a.sort_order - b.sort_order; });

  total.amount_plan = round2_(total.amount_plan);
  total.used_amount = round2_(total.used_amount);
  total.remain_amount = round2_(total.amount_plan - total.used_amount);
  total.pct = total.amount_plan > 0 ? Math.min(100, round2_(total.used_amount * 100 / total.amount_plan)) : 0;

  // 5 รายการขออนุมัติซื้อล่าสุด
  var catById = categoryMap_();
  var recent = readAll_('Purchases')
    .filter(activeOnly_)
    .filter(function (r) { return normalizeFiscalYear_(r.fiscal_year) === fy; })
    .sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); })
    .slice(0, 5)
    .map(function (r) {
      return {
        id: r.id, code: r.code, name: r.name, unit: r.unit,
        qty: num_(r.qty), amount: num_(r.amount), vendor: r.vendor || '',
        date: r.date || '', by: r.created_by || '',
        category_name: (catById[r.category_id] || {}).name || ''
      };
    });

  return {
    status: 'success',
    fiscal_year: fy,
    years: fiscalYearList_(cfg),
    total: total,
    by_category: list,
    recent: recent
  };
}

// ============================================================ รายงาน
function apiGetReport_(p) {
  var cfg = readConfig_();
  var fy = normalizeFiscalYear_(p.fiscal_year) || fiscalYearOf_(cfg);
  var catId = p.category_id || '';
  var mode = p.mode || 'plan'; // plan = รายรายการตามแผน · purchase = รายการขออนุมัติซื้อ
  var cats = categoryMap_();

  if (mode === 'purchase') {
    var pr = apiGetPurchases_({
      fiscal_year: fy, category_id: catId, limit: 10000,
      from: p.from, to: p.to
    });
    // รายงานอ่านง่ายกว่าถ้าเรียงตามวันที่ > ประเภทแผน > รหัส
    var list = pr.data.slice().sort(function (a, b) {
      if (a.date !== b.date) return String(a.date).localeCompare(String(b.date));
      if (a.category_name !== b.category_name) return String(a.category_name).localeCompare(String(b.category_name), 'th');
      return String(a.code).localeCompare(String(b.code));
    });
    return {
      status: 'success', mode: mode, fiscal_year: fy,
      from: pr.from, to: pr.to, by_date: pr.by_date,
      hospital_name: cfg.hospital_name || CONFIG.HOSPITAL_NAME,
      data: list,
      by_category: summarizePurchasesByCategory_(list),
      total: pr.total
    };
  }

  var res = apiGetPlanResult_({ fiscal_year: fy, category_id: catId });
  var groups = {};
  res.data.forEach(function (r) {
    if (!groups[r.category_id]) {
      var c = cats[r.category_id] || {};
      groups[r.category_id] = {
        id: r.category_id, name: r.category_name, color: r.category_color,
        sort_order: Number(c.sort_order) || 999, rows: [],
        amount_plan: 0, used_amount: 0, remain_amount: 0
      };
    }
    var g = groups[r.category_id];
    g.rows.push(r);
    g.amount_plan += r.amount_plan;
    g.used_amount += r.used_amount;
  });

  var list = Object.keys(groups).map(function (k) {
    var g = groups[k];
    g.amount_plan = round2_(g.amount_plan);
    g.used_amount = round2_(g.used_amount);
    g.remain_amount = round2_(g.amount_plan - g.used_amount);
    g.pct = g.amount_plan > 0 ? Math.min(100, round2_(g.used_amount * 100 / g.amount_plan)) : 0;
    return g;
  }).sort(function (a, b) { return a.sort_order - b.sort_order; });

  return {
    status: 'success', mode: 'plan', fiscal_year: fy,
    hospital_name: cfg.hospital_name || CONFIG.HOSPITAL_NAME,
    groups: list, total: res.total
  };
}

// ============================================================ ส่งออก Excel
function apiExportData_(p) {
  var cfg = readConfig_();
  var kind = p.kind || 'plan';
  var fy = normalizeFiscalYear_(p.fiscal_year) || fiscalYearOf_(cfg);
  var catId = p.category_id || '';
  var columns, rows = [];
  var label, period = '';

  if (kind === 'purchase') {
    label = 'ขออนุมัติซื้อ';
    columns = ['วันที่', 'ประเภทแผน', 'รหัสรายการ', 'ชื่อรายการ', 'หน่วยนับ', 'จำนวนที่ขอซื้อ', 'ราคาต่อหน่วย', 'วงเงินที่ขอซื้อ', 'ผู้ขาย', 'เลขที่เอกสาร', 'เกินแผน', 'บันทึกโดย'];
    var pd = apiGetPurchases_({ fiscal_year: fy, category_id: catId, limit: 10000, from: p.from, to: p.to });
    pd.data.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); }).forEach(function (r) {
      rows.push([r.date, r.category_name, r.code, r.name, r.unit, r.qty, r.unit_price, r.amount, r.vendor, r.doc_no, r.over_plan ? 'เกินแผน' : '', r.by]);
    });
    if (pd.by_date) period = (pd.from || '') + (pd.to && pd.to !== pd.from ? '_ถึง_' + pd.to : '');
  } else {
    label = (kind === 'result') ? 'ผลตามแผน' : 'แผนประจำปี';
    columns = ['ประเภทแผน', 'รหัสรายการ', 'ชื่อรายการ', 'หน่วยนับ',
               'จำนวนตามแผน', 'วงเงินตามแผน',
               'จำนวนที่ขอซื้อ', 'วงเงินที่ขอซื้อ',
               'จำนวนคงเหลือ', 'วงเงินคงเหลือ', 'ใช้ไป (%)'];
    apiGetPlanResult_({ fiscal_year: fy, category_id: catId }).data.forEach(function (r) {
      rows.push([r.category_name, r.code, r.name, r.unit,
                 r.qty_plan, r.amount_plan,
                 r.used_qty, r.used_amount,
                 r.remain_qty, r.remain_amount, r.pct]);
    });
  }

  var fname = 'TheWatcher_' + label + '_' + (period || ('ปีงบ' + fy)) + '.xlsx';
  return { status: 'success', columns: columns, rows: rows, filename: fname, count: rows.length, fiscal_year: fy };
}

// ============================================================ จัดการผู้ใช้
function apiGetUsers_() {
  var users = readAll_('Users').map(function (u) {
    var rk = roleKeyOf_(u);
    return {
      id: u.id, username: u.username,
      name: u.name || CONFIG.USER_ROLES[rk].name,
      role: rk, role_name: CONFIG.USER_ROLES[rk].name,
      active: u.active !== false, last_login: u.last_login || ''
    };
  });
  return { status: 'success', data: users, roles: CONFIG.USER_ROLES };
}

function apiSaveUser_(u) {
  if (!u || !String(u.username || '').trim()) return { status: 'error', message: 'กรุณากรอกชื่อผู้ใช้' };
  var username = String(u.username).trim();
  var role = CONFIG.USER_ROLES[u.role] ? u.role : 'user';
  var name = String(u.name || '').trim() || CONFIG.USER_ROLES[role].name;
  var users = readAll_('Users');

  if (u.id) {
    var ex = findById_('Users', u.id);
    if (!ex) return { status: 'error', message: 'ไม่พบผู้ใช้' };
    for (var i = 0; i < users.length; i++) {
      if (users[i].username === username && users[i].id !== u.id) return { status: 'error', message: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' };
    }
    ex.username = username; ex.name = name; ex.role = role;
    ex.permissions = CONFIG.USER_ROLES[role].permissions;
    if (u.active !== undefined) ex.active = !!u.active;
    if (u.password && String(u.password).length >= 4) ex.password = String(u.password);
    ex.updated_at = now_();
    updateRecord_('Users', u.id, ex);
    return { status: 'success', message: 'บันทึกผู้ใช้แล้ว' };
  }

  for (var j = 0; j < users.length; j++) {
    if (users[j].username === username) return { status: 'error', message: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' };
  }
  if (!u.password || String(u.password).length < 4) return { status: 'error', message: 'ตั้งรหัสผ่านอย่างน้อย 4 ตัวอักษร' };

  appendRecord_('Users', {
    id: Utilities.getUuid(), username: username, password: String(u.password),
    role: role, name: name, permissions: CONFIG.USER_ROLES[role].permissions,
    active: true, last_login: '', created_at: now_(), updated_at: now_()
  });
  return { status: 'success', message: 'เพิ่มผู้ใช้แล้ว' };
}

function apiDeleteUser_(id, actor) {
  var ex = findById_('Users', id);
  if (!ex) return { status: 'error', message: 'ไม่พบผู้ใช้' };
  if (ex.username === actor.username) return { status: 'error', message: 'ลบบัญชีตัวเองไม่ได้' };
  var admins = readAll_('Users').filter(function (u) { return u.active !== false && roleKeyOf_(u) === 'admin'; });
  if (roleKeyOf_(ex) === 'admin' && admins.length <= 1) return { status: 'error', message: 'ต้องเหลือผู้ดูแลระบบอย่างน้อย 1 บัญชี' };
  deleteRecord_('Users', id);
  return { status: 'success', message: 'ลบผู้ใช้แล้ว' };
}

// ============================================================ UTILS
function num_(v) {
  if (v === null || v === undefined || v === '') return 0;
  var n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function round2_(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function fmtNum_(n) {
  return round2_(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function todayIso_() {
  var tz = Session.getScriptTimeZone();
  return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
}

function now_() { return new Date().toISOString(); }

function logError_(where, err) {
  try {
    appendRecord_('Errors', {
      id: Utilities.getUuid(),
      where: where,
      message: String(err && err.message ? err.message : err),
      stack: String(err && err.stack ? err.stack : ''),
      created_at: now_()
    });
  } catch (_) {}
}
