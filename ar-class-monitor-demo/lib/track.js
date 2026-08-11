/**
 * AR 教学监控 · track() 预埋上报模块（学员作品模板通用）
 *
 * 用法（学员作品里最简接入）：
 *   <script src="lib/track.js"></script>
 *   <script>
 *     Track.config({ endpoint: '/api/collect' });   // 默认同源，部署时可改成监控服务器地址
 *     Track.config({ sid: '{{student_id}}' });      // 可选：老师/平台注入学员标识
 *     Track.event('game_start', { level: 1 });
 *   </script>
 *
 * 行为：
 *   - 自动带 sid：优先 ?sid= URL 参数 → 其次 localStorage → 最后随机匿名 id
 *   - POST /api/collect 上报（跨域自动处理，服务端 CORS 已开）
 *   - 同源时同时写 localStorage（兼容现有老师看板 demo 直读）
 *   - 失败静默，绝不打断学生操作
 *   - 页面加载自动上报 page_loaded（= 用户开始使用作品）
 */
(function () {
  'use strict';
  var KEY = 'ar_class_monitor_events';
  var SID_KEY = 'ar_class_monitor_sid';
  var DEFAULT_ENDPOINT = '/api/collect';
  var cfg = { endpoint: DEFAULT_ENDPOINT, sid: null, page: null, verbose: false };

  function getSid() {
    if (cfg.sid) return cfg.sid;
    // 1) URL ?sid=
    try {
      var m = /[?&]sid=([^&]+)/.exec(location.search);
      if (m && m[1]) { cfg.sid = decodeURIComponent(m[1]); return cfg.sid; }
    } catch (e) {}
    // 2) localStorage
    try {
      var ls = localStorage.getItem(SID_KEY);
      if (ls) { cfg.sid = ls; return ls; }
    } catch (e) {}
    // 3) 随机匿名
    var id = 'stu_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
    try { localStorage.setItem(SID_KEY, id); } catch (e) {}
    cfg.sid = id;
    return id;
  }

  function toLocal(e) {
    try {
      var arr = JSON.parse(localStorage.getItem(KEY) || '[]');
      arr.push(e);
      if (arr.length > 5000) arr = arr.slice(-5000);
      localStorage.setItem(KEY, JSON.stringify(arr));
    } catch (e) {}
  }

  function toServer(e) {
    try {
      var req = new XMLHttpRequest();
      req.open('POST', cfg.endpoint, true);
      req.setRequestHeader('Content-Type', 'application/json');
      req.onload = function () {};
      req.onerror = function () {};
      req.send(JSON.stringify(e));
    } catch (e) {}
  }

  window.Track = {
    config: function (opts) {
      if (opts) { for (var k in opts) { if (Object.prototype.hasOwnProperty.call(opts, k)) cfg[k] = opts[k]; } }
    },
    getSid: getSid,
    event: function (event, payload) {
      var e = {
        ts: Date.now(),
        sid: getSid(),
        event: event,
        payload: payload || {}
      };
      if (cfg.page) e.payload.page = cfg.page;
      if (cfg.course) e.payload.course = cfg.course;   // 课标：0预备/1第一/2第二/4综合 —— 老师端按课聚合必需
      toLocal(e);
      toServer(e);
      if (cfg.verbose) console.log('[Track]', event, payload);
      return e;
    }
  };

  // 自动：页面加载即上报（= 作品被打开使用）
  if (typeof window !== 'undefined') {
    window.addEventListener('load', function () {
      try {
        Track.event('page_loaded', { url: location.href, title: document.title });
      } catch (e) {}
    });
  }
})();
