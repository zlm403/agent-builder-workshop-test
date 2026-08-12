/**
 * qw-chat-fwd.js — 顷悟 AI 应用对话自动转发（AR 教学监控）
 *
 * 用法（学生作品页 index.html 里加一行，放在 qingwu-sdk 之后）：
 *   <script src="lib/qw-chat-fwd.js"></script>
 *
 * 行为：
 *   - 包装顷悟 SDK 的 ai.chat()：学生每发一条消息、AI 每回一条，
 *     自动 POST /api/collect 上报 agent_dialog_req / agent_dialog_resp。
 *   - 自动带 sid（优先 ?sid= URL 参数 → localStorage → 随机匿名），
 *     与签到体系对齐：学生屏签到的上课号即 sid。
 *   - 自动带 task（课标 pre/t1/t2/t3，默认 t1，可用 window.QW_TASK 覆盖）。
 *   - 静默失败：监控服务不在线时不打断学生操作。
 *   - 无论作品怎么调用 ai.chat（普通/流式），都通过包装截获输入输出。
 */

(function () {
  'use strict';
  if (window.__qwChatFwdLoaded) return;
  window.__qwChatFwdLoaded = true;

  var ENDPOINT = window.QW_COLLECT_ENDPOINT || '/api/collect';
  var TASK = window.QW_TASK || 't1';
  var SID_KEY = 'ar_class_monitor_sid';

  function getSid() {
    try {
      var m = /[?&]sid=([^&]+)/.exec(location.search);
      if (m && m[1]) return decodeURIComponent(m[1]);
      var ls = localStorage.getItem(SID_KEY);
      if (ls) return ls;
      var id = 'stu_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
      localStorage.setItem(SID_KEY, id);
      return id;
    } catch (e) { return 'stu_anon'; }
  }

  function post(event, payload) {
    try {
      var body = { ts: Date.now(), sid: getSid(), event: event, payload: payload || {} };
      var req = new XMLHttpRequest();
      req.open('POST', ENDPOINT, true);
      req.setRequestHeader('Content-Type', 'application/json');
      req.send(JSON.stringify(body));
    } catch (e) {}
  }

  // 轮询等待 ai.chat 出现（SDK 异步加载），出现后立即包装
  var attempts = 0;
  function hook() {
    if (typeof window.ai !== 'undefined' && window.ai && typeof window.ai.chat === 'function') {
      var origChat = window.ai.chat;
      window.ai.chat = function (messages, options) {
        var userMsg = '';
        if (Array.isArray(messages) && messages.length) {
          var last = messages[messages.length - 1];
          if (last && last.content) userMsg = last.content;
        }
        if (userMsg) post('agent_dialog_req', { text: userMsg, task: TASK, channel: 'qingwu-agent' });

        var res = origChat.apply(this, arguments);
        if (res && typeof res.then === 'function') {
          return res.then(function (r) {
            var reply = (r && (r.content || r.reply || r.text)) || '';
            if (reply) post('agent_dialog_resp', { reply: reply, task: TASK, channel: 'qingwu-agent' });
            return r;
          });
        }
        return res;
      };
    } else {
      attempts++;
      if (attempts < 100) setTimeout(hook, 200);   // 最多等 20 秒
    }
  }

  if (typeof window.ai !== 'undefined' && window.ai && typeof window.ai.chat === 'function') {
    hook();
  } else {
    setTimeout(hook, 200);
  }
})();
