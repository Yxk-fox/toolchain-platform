/*
@File    :  alerts.js
@Time    :  2026/08/05 17:15:16
@Author  :  fox
@Version :  4.0
@Desc    :  T2.1告警中心模块，实现离线环境实时告警检测、告警列表展示、
           告警确认/删除、铃铛徽章计数刷新等功能，依赖ToolchainApp核心命名空间
*/
(function() {
  'use strict';

  var TA = window.ToolchainApp;
  if (!TA) { console.error('[alerts.js] ToolchainApp 命名空间未就绪'); return; }
  var $ = TA.$;
  var apiFetch = TA.apiFetch;
  var escHtml = TA.escHtml;
  var formatDate = TA.formatDate;
  var toast = TA.toast;
  var hasPermission = TA.hasPermission;
  var appState = TA.appState;

  var FILTERS = [
    { key: 'all',           label: '全部' },
    { key: 'active',        label: '未处理' },
    { key: 'acknowledged',  label: '已确认' },
    { key: 'resolved',      label: '已恢复' }
  ];

  // 告警徽章：定期拉取 active 告警数，更新顶栏铃铛
  // 加节流：5 秒内最多请求一次，避免 WebSocket 高频推送时 N+1 请求风暴
  var _badgeInFlight = false;
  var _badgeLastTs = 0;
  var _badgePending = false;
  function refreshAlertBadge() {
    var btn = $('#alertBellBtn');
    var badge = $('#alertBadge');
    if (!appState.currentUser || appState.currentUser.role !== 'superadmin') {
      if (btn) btn.style.display = 'none';
      if (badge) badge.style.display = 'none';
      return;
    }
    var now = Date.now();
    if (_badgeInFlight) { _badgePending = true; return; }
    if (now - _badgeLastTs < 5000) {
      _badgePending = true;
      return;
    }
    _badgeInFlight = true;
    _badgeLastTs = now;
    apiFetch('/alerts?status=active').then(function(res) {
      var count = (res && res.alerts) ? res.alerts.length : 0;
      if (btn) btn.style.display = '';
      if (badge) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.style.display = count > 0 ? '' : 'none';
      }
    }).catch(function() {
      // 静默失败，不打扰用户
    }).finally(function() {
      _badgeInFlight = false;
      if (_badgePending) {
        _badgePending = false;
        setTimeout(refreshAlertBadge, 100);
      }
    });
  }

  function statusBadge(status) {
    var map = {
      active:       { cls: 'badge-active',       text: '未处理' },
      acknowledged: { cls: 'badge-acknowledged', text: '已确认' },
      resolved:     { cls: 'badge-resolved',     text: '已恢复' }
    };
    var m = map[status] || { cls: 'badge-other', text: status || '-' };
    return '<span class="alert-status-badge ' + m.cls + '">' + escHtml(m.text) + '</span>';
  }

  function renderAlerts(content) {
    if (!appState.currentUser) {
      content.innerHTML = '<div class="empty-state"><i class="fa-solid fa-lock"></i><p>请先登录后查看告警</p></div>';
      return;
    }
    content.innerHTML =
      '<h2 class="page-title" style="display:flex;align-items:center;gap:8px;">' +
        '<i class="fa-solid fa-bell"></i> 告警中心' +
      '</h2>' +
      '<div class="alerts-toolbar" style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap;">' +
        FILTERS.map(function(f) {
          return '<button class="topbar-btn alert-filter-btn' + (f.key === 'all' ? ' active' : '') + '" data-filter="' + f.key + '">' + escHtml(f.label) + '</button>';
        }).join('') +
        '<button class="topbar-btn" id="refreshAlertsBtn" title="刷新"><i class="fa-solid fa-rotate"></i></button>' +
      '</div>' +
      '<div id="alertsList">加载中…</div>';

    var currentFilter = 'all';
    var listEl = $('#alertsList');

    function load() {
      listEl.innerHTML = '<p style="color:var(--text-muted);padding:16px;">加载中…</p>';
      var url = '/alerts';
      if (currentFilter !== 'all') url += '?status=' + currentFilter;
      apiFetch(url).then(function(res) {
        var alerts = (res && res.alerts) || [];
        if (!alerts.length) {
          listEl.innerHTML = '<div class="empty-state"><i class="fa-solid fa-circle-check"></i><p>暂无告警记录</p></div>';
          return;
        }
        var canDelete = hasPermission('delete');
        listEl.innerHTML = '<table class="data-table alerts-table" style="width:100%;border-collapse:collapse;">' +
          '<thead><tr>' +
            '<th style="text-align:left;padding:8px;">环境</th>' +
            '<th style="text-align:left;padding:8px;">类型</th>' +
            '<th style="text-align:left;padding:8px;">消息</th>' +
            '<th style="text-align:left;padding:8px;">状态</th>' +
            '<th style="text-align:left;padding:8px;">发生时间</th>' +
            '<th style="text-align:left;padding:8px;">处理时间</th>' +
            '<th style="text-align:left;padding:8px;">操作</th>' +
          '</tr></thead><tbody>' +
          alerts.map(function(a) {
            var typeLabel = a.type === 'offline' ? '离线' : (a.type || '-');
            var ackInfo = a.acknowledged_at ? (formatDate(a.acknowledged_at) + ' / ' + escHtml(a.acknowledged_by || '')) : '-';
            var actionHtml = '';
            if (a.status === 'active') {
              actionHtml = '<button class="topbar-btn alert-ack-btn" data-id="' + a.id + '" style="padding:4px 10px;font-size:12px;">确认</button>';
            }
            if (canDelete) {
              actionHtml += ' <button class="topbar-btn alert-del-btn" data-id="' + a.id + '" style="padding:4px 10px;font-size:12px;color:#dc2626;">删除</button>';
            }
            return '<tr>' +
              '<td style="padding:8px;">' + escHtml(a.env_name || '-') + '</td>' +
              '<td style="padding:8px;"><span class="alert-type-tag alert-type-' + escHtml(a.type || 'other') + '">' + escHtml(typeLabel) + '</span></td>' +
              '<td style="padding:8px;">' + escHtml(a.message || '') + '</td>' +
              '<td style="padding:8px;">' + statusBadge(a.status) + '</td>' +
              '<td style="padding:8px;color:var(--text-muted);font-size:12px;">' + (a.created_at ? formatDate(a.created_at) : '-') + '</td>' +
              '<td style="padding:8px;color:var(--text-muted);font-size:12px;">' + ackInfo + '</td>' +
              '<td style="padding:8px;">' + actionHtml + '</td>' +
            '</tr>';
          }).join('') +
          '</tbody></table>';

        // 绑定操作按钮
        var ackBtns = listEl.querySelectorAll('.alert-ack-btn');
        ackBtns.forEach(function(btn) {
          btn.addEventListener('click', function() {
            var id = btn.getAttribute('data-id');
            apiFetch('/alerts/' + id + '/ack', { method: 'POST' }).then(function() {
              toast('告警已确认', 'success');
              load();
              refreshAlertBadge();
            }).catch(function(e) { toast('确认失败: ' + e.message, 'error'); });
          });
        });
        var delBtns = listEl.querySelectorAll('.alert-del-btn');
        delBtns.forEach(function(btn) {
          btn.addEventListener('click', function() {
            if (!confirm('确定删除此告警记录？')) return;
            var id = btn.getAttribute('data-id');
            apiFetch('/alerts/' + id, { method: 'DELETE' }).then(function() {
              toast('已删除', 'success');
              load();
              refreshAlertBadge();
            }).catch(function(e) { toast('删除失败: ' + e.message, 'error'); });
          });
        });
      }).catch(function(e) {
        listEl.innerHTML = '<p style="color:#dc2626;padding:16px;">加载失败: ' + escHtml(e.message) + '</p>';
      });
    }

    // 过滤按钮
    content.querySelectorAll('.alert-filter-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        currentFilter = btn.getAttribute('data-filter');
        content.querySelectorAll('.alert-filter-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        load();
      });
    });
    var refreshBtn = $('#refreshAlertsBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', load);

    load();
  }

  // 绑定顶栏铃铛点击 → 跳转告警中心
  function bindBell() {
    var btn = $('#alertBellBtn');
    if (btn && !btn._alertBound) {
      btn._alertBound = true;
      btn.addEventListener('click', function() {
        if (typeof TA.navigateTo === 'function') TA.navigateTo('alerts');
      });
    }
  }

  // 暴露到命名空间
  TA.renderAlerts = renderAlerts;
  TA.refreshAlertBadge = refreshAlertBadge;

  // DOM 就绪后绑定铃铛，并启动定时刷新徽章
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { bindBell(); refreshAlertBadge(); setInterval(refreshAlertBadge, 30000); });
  } else {
    bindBell(); refreshAlertBadge(); setInterval(refreshAlertBadge, 30000);
  }
})();
