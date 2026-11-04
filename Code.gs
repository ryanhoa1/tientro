/**
 * Gửi mã xác minh 6 số về Gmail để đăng nhập app Tiền Trọ.
 * Dán toàn bộ file này vào Google Apps Script, rồi Triển khai > Ứng dụng web
 * (Thực thi với tư cách: Tôi | Ai có quyền truy cập: Bất kỳ ai).
 */
var OWNER = 'hoangvucntt@gmail.com';   // chỉ email này nhận được mã
var APP_NAME = 'Nhà trọ Bùi Văn Hòa';
var CODE_TTL = 600;        // mã sống 10 phút
var MAX_TRIES = 5;         // sai quá 5 lần là phải xin mã mới
var RESEND_GAP = 45;       // giây tối thiểu giữa 2 lần gửi
var MAX_PER_HOUR = 8;      // tối đa số mã gửi mỗi giờ

function doGet() { return out_({ ok: true, msg: 'OTP service is running' }); }

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.a === 'send') return out_(send_());
    if (body.a === 'verify') return out_(verify_(String(body.code || '')));
    return out_({ ok: false, error: 'Yêu cầu không hợp lệ' });
  } catch (err) {
    return out_({ ok: false, error: 'Lỗi máy chủ, thử lại sau' });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function send_() {
  var c = CacheService.getScriptCache();
  if (c.get('gap')) return { ok: false, error: 'Vui lòng đợi ' + RESEND_GAP + ' giây rồi gửi lại mã' };
  var n = Number(c.get('cnt') || 0);
  if (n >= MAX_PER_HOUR) return { ok: false, error: 'Đã gửi quá nhiều mã, hãy thử lại sau 1 giờ' };
  var code = ('000000' + (parseInt(hash_(Utilities.getUuid()).slice(0, 8), 16) % 1000000)).slice(-6);
  c.put('otp', hash_(code), CODE_TTL);
  c.put('tries', '0', CODE_TTL);
  c.put('gap', '1', RESEND_GAP);
  c.put('cnt', String(n + 1), 3600);
  MailApp.sendEmail({
    to: OWNER,
    subject: 'Mã đăng nhập ' + APP_NAME + ': ' + code,
    body: 'Mã xác minh của bạn là: ' + code + '\n\nMã có hiệu lực trong ' + (CODE_TTL / 60) +
      ' phút. Nếu bạn không yêu cầu, hãy bỏ qua email này và không chia sẻ mã cho ai.',
    name: APP_NAME
  });
  return { ok: true };
}

function verify_(code) {
  var c = CacheService.getScriptCache();
  var saved = c.get('otp');
  if (!saved) return { ok: false, error: 'Mã đã hết hạn, hãy gửi mã mới' };
  var tries = Number(c.get('tries') || 0) + 1;
  if (tries > MAX_TRIES) { c.remove('otp'); return { ok: false, error: 'Nhập sai quá nhiều lần, hãy gửi mã mới' }; }
  c.put('tries', String(tries), CODE_TTL);
  if (!/^\d{6}$/.test(code) || hash_(code) !== saved) return { ok: false, error: 'Mã không đúng' };
  c.remove('otp');
  return { ok: true };
}

function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s + '|tientro')
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Chạy hàm này một lần trong trình soạn thảo để cấp quyền gửi email. */
function authorize() { MailApp.getRemainingDailyQuota(); }
