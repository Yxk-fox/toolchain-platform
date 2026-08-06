/*
@File    :  recycle.js
@Time    :  2026/08/05 17:15:16
@Author  :  fox
@Version :  4.0
@Desc    :  T2.2资源回收审批流模块，提供回收申请提交、审批列表展示、
           通过/驳回/执行回收等功能，包含通用回收弹窗组件
*/
(function() {
  'use strict';

  var TA = window.ToolchainApp;
  if (!TA) { console.error('[recycle.js] ToolchainApp 命名空间未就绪'); return; }
  var $ = TA.$;
  var apiFetch = TA.apiFetch;
  var escHtml = TA.escHtml;
  var formatDate = TA.formatDate;
  var toast = TA.toast;
  var hasPermission = TA.hasPermission;
  var appState = TA.appState;

  var STATUS_MAP = {
    pending:  { cls: 'rc-status-pending',  text: '待审批' },
    approved: { cls: 'rc-status-approved', text: '已通过' },
    rejected: { cls: 'rc-status-rejected',text: '已驳回' },
    done:     { cls: 'rc-status-done',     text: '已回收' }
  };
  var TYPE_MAP = { env: '环境', tool: '工具', program: '程序' };

  function statusBadge(status) {
    var m = STATUS_MAP[status] || { cls: 'rc-status-other', text: status || '-' };
    return '<span class="rc-status-badge ' + m.cls + '">' + escHtml(m.text) + '</span>';
  }

  // 通用"申请回收"弹窗：任何资源详情页/列表页都可调用
  function openRecycleDialog(resourceType, resourceId, resourceName) {
    if (!appState.currentUser) { toast('请先登录', 'error'); return; }
    var showModal = TA.showModal;
    var closeModal = TA.closeModal;
    if (!showModal || !closeModal) { toast('弹窗组件未就绪', 'error'); return; }

    var typeLabel = TYPE_MAP[resourceType] || resourceType;
    showModal(
      '<h3 style="margin:0 0 12px;"><i class="fa-solid fa-recycle"></i> 申请回收' + escHtml(typeLabel) + '</h3>' +
      '<div style="margin-bottom:12px;color:var(--text-muted);">资源：<b>' + escHtml(resourceName || ('#' + resourceId)) + '</b></div>' +
      '<label style="display:block;margin-bottom:6px;">回收原因（选填）</label>' +
      '<textarea id="recycleReason" rows="3" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border-color);border-radius:4px;background:var(--input-bg);color:var(--text-color);" placeholder="例如：项目下线，环境不再使用"></textarea>' +
      '<div style="margin-top:14px;text-align:right;">' +
        '<button class="topbar-btn" id="recycleCancel" style="margin-right:8px;">取消</button>' +
        '<button class="topbar-btn" id="recycleSubmit" style="background:var(--primary-color);color:#fff;">提交申请</button>' +
      '</div>'
    );

    $('#recycleCancel').addEventListener('click', closeModal);
    $('#recycleSubmit').addEventListener('click', function() {
      var reason = $('#recycleReason').value || '';
      var btn = this;
      btn.disabled = true; btn.textContent = '提交中…';
      apiFetch('/recycle-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource_type: resourceType, resource_id: resourceId, reason: reason })
      }).then(function(r) {
        toast('回收申请已提交，等待审批', 'success');
        closeModal();
      }).catch(function(e) {
        toast('提交失败: ' + e.message, 'error');
        btn.disabled = false; btn.textContent = '提交申请';
      });
    });
  }

  // 设置页"回收审批"工作台
  function renderRecycleRequests(content) {
    if (!appState.currentUser) {
      content.innerHTML = '<div class="empty-state"><i class="fa-solid fa-lock"></i><p>请先登录</p></div>';
      return;
    }
    var isAdmin = appState.currentUser.role === 'superadmin';
    content.innerHTML =
      '<h2 class="page-title" style="display:flex;align-items:center;gap:8px;">' +
        '<i class="fa-solid fa-recycle"></i> 资源回收审批' +
      '</h2>' +
      '<div class="alerts-toolbar" style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap;">' +
        ['all','pending','approved','rejected','done'].map(function(k, i) {
          var labels = { all:'全部', pending:'待审批', approved:'已通过', rejected:'已驳回', done:'已回收' };
          return '<button class="topbar-btn alert-filter-btn' + (i===0?' active':'') + '" data-filter="' + k + '">' + labels[k] + '</button>';
        }).join('') +
        '<button class="topbar-btn" id="refreshRcBtn" title="刷新"><i class="fa-solid fa-rotate"></i></button>' +
      '</div>' +
      '<div id="rcList">加载中…</div>';

    var currentFilter = 'all';
    var listEl = $('#rcList');

    function load() {
      listEl.innerHTML = '<p style="color:var(--text-muted);padding:16px;">加载中…</p>';
      var url = '/recycle-requests';
      if (currentFilter !== 'all') url += '?status=' + currentFilter;
      apiFetch(url).then(function(res) {
        var reqs = (res && res.requests) || [];
        if (!reqs.length) {
          listEl.innerHTML = '<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>暂无回收申请</p></div>';
          return;
        }
        listEl.innerHTML = '<table class="data-table alerts-table" style="width:100%;border-collapse:collapse;">' +
          '<thead><tr>' +
            '<th style="text-align:left;padding:8px;">资源</th>' +
            '<th style="text-align:left;padding:8px;">类型</th>' +
            '<th style="text-align:left;padding:8px;">申请人</th>' +
            '<th style="text-align:left;padding:8px;">原因</th>' +
            '<th style="text-align:left;padding:8px;">状态</th>' +
            '<th style="text-align:left;padding:8px;">申请时间</th>' +
            '<th style="text-align:left;padding:8px;">审批/执行</th>' +
            '<th style="text-align:left;padding:8px;">操作</th>' +
          '</tr></thead><tbody>' +
          reqs.map(function(r) {
            var approverInfo = r.approver_name ? (escHtml(r.approver_name) + ' / ' + (r.approved_at ? formatDate(r.approved_at) : (r.rejected_at ? formatDate(r.rejected_at) : '-'))) : '-';
            var actionHtml = '';
            if (isAdmin) {
              if (r.status === 'pending') {
                actionHtml = '<button class="topbar-btn rc-approve-btn" data-id="' + r.id + '" style="padding:4px 10px;font-size:12px;background:#16a34a;color:#fff;">通过</button>' +
                  ' <button class="topbar-btn rc-reject-btn" data-id="' + r.id + '" style="padding:4px 10px;font-size:12px;background:#dc2626;color:#fff;">驳回</button>';
              } else if (r.status === 'approved') {
                actionHtml = '<button class="topbar-btn rc-execute-btn" data-id="' + r.id + '" style="padding:4px 10px;font-size:12px;background:#d97706;color:#fff;">执行回收</button>';
              }
            }
            return '<tr>' +
              '<td style="padding:8px;">' + escHtml(r.resource_name || '-') + '</td>' +
              '<td style="padding:8px;">' + escHtml(TYPE_MAP[r.resource_type] || r.resource_type) + '</td>' +
              '<td style="padding:8px;">' + escHtml(r.requester_name || '-') + '</td>' +
              '<td style="padding:8px;max-width:240px;word-break:break-all;">' + escHtml(r.reason || '-') + '</td>' +
              '<td style="padding:8px;">' + statusBadge(r.status) + '</td>' +
              '<td style="padding:8px;color:var(--text-muted);font-size:12px;">' + (r.created_at ? formatDate(r.created_at) : '-') + '</td>' +
              '<td style="padding:8px;color:var(--text-muted);font-size:12px;">' + approverInfo + '</td>' +
              '<td style="padding:8px;">' + actionHtml + '</td>' +
            '</tr>';
          }).join('') +
          '</tbody></table>';

        // 绑定操作
        function bind(selector, url, successMsg) {
          listEl.querySelectorAll(selector).forEach(function(btn) {
            btn.addEventListener('click', function() {
              var id = btn.getAttribute('data-id');
              btn.disabled = true;
              apiFetch(url.replace('{id}', id), { method: 'POST' }).then(function() {
                toast(successMsg, 'success');
                load();
              }).catch(function(e) {
                toast('操作失败: ' + e.message, 'error');
                btn.disabled = false;
              });
            });
          });
        }
        bind('.rc-approve-btn', '/recycle-requests/{id}/approve', '已通过');
        bind('.rc-reject-btn', '/recycle-requests/{id}/reject', '已驳回');
        bind('.rc-execute-btn', '/recycle-requests/{id}/execute', '回收已执行');
        // 执行回收前确认
        listEl.querySelectorAll('.rc-execute-btn').forEach(function(btn) {
          var origClick = btn.onclick;
          btn.addEventListener('click', function(ev) {
            if (!confirm('确定执行回收？该操作将删除资源且不可恢复！')) {
              ev.stopImmediatePropagation();
              btn.disabled = false;
            }
          }, true);
        });
      }).catch(function(e) {
        listEl.innerHTML = '<p style="color:#dc2626;padding:16px;">加载失败: ' + escHtml(e.message) + '</p>';
      });
    }

    content.querySelectorAll('.alert-filter-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        currentFilter = btn.getAttribute('data-filter');
        content.querySelectorAll('.alert-filter-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        load();
      });
    });
    var refreshBtn = $('#refreshRcBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', load);

    load();
  }

  TA.renderRecycleRequests = renderRecycleRequests;
  TA.openRecycleDialog = openRecycleDialog;
})();
