/*
@File    :  services.js
@Time    :  2026/08/05 17:15:16
@Author  :  fox
@Version :  4.0
@Desc    :  T3服务目录与依赖图谱模块，实现服务列表展示、服务详情页、
           服务健康评分卡、依赖关系可视化图谱等功能
*/
(function() {
  'use strict';

  var TA = window.ToolchainApp;
  if (!TA) { console.error('[services.js] ToolchainApp 命名空间未就绪'); return; }
  var $ = TA.$;
  var $$ = TA.$$;
  var apiFetch = TA.apiFetch;
  var escHtml = TA.escHtml;
  var formatDate = TA.formatDate;
  var toast = TA.toast;
  var hasPermission = TA.hasPermission;
  var appState = TA.appState;
  var showModal = TA.showModal;
  var closeModal = TA.closeModal;

  var TYPE_MAP = {
    backend: { label: '后端', icon: 'fa-server', color: '#3b82f6' },
    frontend: { label: '前端', icon: 'fa-window-maximize', color: '#8b5cf6' },
    middleware: { label: '中间件', icon: 'fa-layer-group', color: '#f59e0b' },
    database: { label: '数据库', icon: 'fa-database', color: '#10b981' },
    job: { label: '定时任务', icon: 'fa-clock', color: '#ec4899' }
  };
  var STATUS_MAP = {
    active: { label: '运行中', cls: 'svc-status-active' },
    deprecated: { label: '已废弃', cls: 'svc-status-deprecated' },
    planning: { label: '规划中', cls: 'svc-status-planning' }
  };
  var DEP_TYPE_MAP = { runtime: '运行时', build: '构建', data: '数据' };
  var SCORECARD_ITEMS = [
    { key: 'has_ci', label: 'CI 流水线' },
    { key: 'has_monitoring', label: '监控告警' },
    { key: 'has_log_aggregation', label: '日志聚合' },
    { key: 'has_backup', label: '数据备份' },
    { key: 'has_doc', label: '文档齐全' }
  ];

  // 当前查看的服务 ID（模块级状态，配合 service-detail 路由）
  var _currentServiceId = null;

  function scoreColor(score) {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    if (score >= 40) return '#f97316';
    return '#dc2626';
  }

  function typeBadge(type) {
    var m = TYPE_MAP[type] || { label: type || '-', icon: 'fa-cube', color: '#6b7280' };
    return '<span class="svc-type-badge" style="background:' + m.color + '1a;color:' + m.color + ';">' +
      '<i class="fa-solid ' + m.icon + '"></i> ' + escHtml(m.label) + '</span>';
  }

  function statusBadge(status) {
    var m = STATUS_MAP[status] || { label: status || '-', cls: 'svc-status-other' };
    return '<span class="svc-status-badge ' + m.cls + '">' + escHtml(m.label) + '</span>';
  }

  function scoreBar(score) {
    var color = scoreColor(score);
    return '<div class="svc-score-bar">' +
      '<div class="svc-score-fill" style="width:' + score + '%;background:' + color + ';"></div>' +
      '<span class="svc-score-text" style="color:' + color + ';">' + score + '</span>' +
    '</div>';
  }

  // ============ 服务列表 ============
  function renderServices(content) {
    if (!appState.currentUser) {
      content.innerHTML = '<div class="empty-state"><i class="fa-solid fa-lock"></i><p>请先登录后查看服务目录</p></div>';
      return;
    }
    var canAdd = hasPermission('add');
    var isSuperadmin = appState.currentUser.role === 'superadmin';
    content.innerHTML =
      '<h2 class="page-title" style="display:flex;align-items:center;gap:8px;">' +
        '<i class="fa-solid fa-sitemap"></i> 服务目录' +
      '</h2>' +
      '<div class="alerts-toolbar" style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap;align-items:center;">' +
        '<input id="svcSearch" class="svc-search" placeholder="搜索服务名称/代号…" style="flex:1;min-width:180px;padding:6px 10px;border:1px solid var(--border-color);border-radius:4px;background:var(--input-bg);color:var(--text-color);">' +
        '<select id="svcTypeFilter" class="svc-filter-sel">' +
          '<option value="">全部类型</option>' +
          Object.keys(TYPE_MAP).map(function(k) { return '<option value="' + k + '">' + TYPE_MAP[k].label + '</option>'; }).join('') +
        '</select>' +
        '<select id="svcStatusFilter" class="svc-filter-sel">' +
          '<option value="">全部状态</option>' +
          Object.keys(STATUS_MAP).map(function(k) { return '<option value="' + k + '">' + STATUS_MAP[k].label + '</option>'; }).join('') +
        '</select>' +
        '<button class="topbar-btn" id="refreshSvcBtn" title="刷新"><i class="fa-solid fa-rotate"></i></button>' +
        (isSuperadmin ? '<button class="topbar-btn" id="svcImportBtn" title="从网址大全导入"><i class="fa-solid fa-file-import"></i> 导入</button>' : '') +
        (hasPermission('delete') ? '<button class="topbar-btn" id="svcExportBtn" title="导出 CSV"><i class="fa-solid fa-file-csv"></i> 导出</button>' : '') +
        (canAdd ? '<button class="topbar-btn" id="svcCreateBtn" style="background:var(--primary-color);color:#fff;"><i class="fa-solid fa-plus"></i> 新建服务</button>' : '') +
      '</div>' +
      '<div id="svcStats" style="margin-bottom:12px;color:var(--text-muted);font-size:13px;"></div>' +
      '<div id="svcGrid" class="svc-grid">加载中…</div>';

    var searchKey = '';
    var typeFilter = '';
    var statusFilter = '';

    function load() {
      var grid = $('#svcGrid');
      grid.innerHTML = '<p style="color:var(--text-muted);padding:16px;">加载中…</p>';
      apiFetch('/services').then(function(res) {
        var services = (res && res.services) || [];
        // 本地筛选
        var filtered = services.filter(function(s) {
          if (typeFilter && s.type !== typeFilter) return false;
          if (statusFilter && s.status !== statusFilter) return false;
          if (searchKey) {
            var hay = (s.name + ' ' + (s.code || '') + ' ' + (s.team || '')).toLowerCase();
            if (hay.indexOf(searchKey.toLowerCase()) === -1) return false;
          }
          return true;
        });
        var statsEl = $('#svcStats');
        if (statsEl) {
          var avgScore = filtered.length ? Math.round(filtered.reduce(function(a, s) { return a + (s.scorecard ? s.scorecard.score : 0); }, 0) / filtered.length) : 0;
          statsEl.textContent = '共 ' + filtered.length + ' 个服务' + (filtered.length ? '，平均就绪分 ' + avgScore : '');
        }
        if (!filtered.length) {
          grid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-sitemap"></i><p>' + (services.length ? '无匹配服务' : '暂无服务，点击"导入"从网址大全批量创建') + '</p></div>';
          return;
        }
        grid.innerHTML = filtered.map(function(s) {
          var score = s.scorecard ? s.scorecard.score : 0;
          return '<div class="svc-card" data-id="' + s.id + '" style="cursor:pointer;">' +
            '<div class="svc-card-head">' +
              '<div class="svc-card-title">' +
                '<i class="fa-solid ' + (TYPE_MAP[s.type] ? TYPE_MAP[s.type].icon : 'fa-cube') + '" style="color:' + (TYPE_MAP[s.type] ? TYPE_MAP[s.type].color : '#6b7280') + ';"></i>' +
                '<span class="svc-name">' + escHtml(s.name) + '</span>' +
              '</div>' +
              statusBadge(s.status) +
            '</div>' +
            '<div class="svc-card-meta">' +
              (s.code ? '<span class="svc-code">' + escHtml(s.code) + '</span>' : '') +
              (s.team ? '<span class="svc-team"><i class="fa-solid fa-users"></i> ' + escHtml(s.team) + '</span>' : '') +
            '</div>' +
            (s.description ? '<div class="svc-desc">' + escHtml(s.description) + '</div>' : '') +
            '<div class="svc-card-foot">' +
              typeBadge(s.type) +
              scoreBar(score) +
            '</div>' +
          '</div>';
        }).join('');
        // 卡片点击 → 详情
        grid.querySelectorAll('.svc-card').forEach(function(card) {
          card.addEventListener('click', function() {
            _currentServiceId = parseInt(card.getAttribute('data-id'), 10);
            TA.navigateTo('service-detail');
          });
        });
      }).catch(function(e) {
        grid.innerHTML = '<p style="color:#dc2626;padding:16px;">加载失败: ' + escHtml(e.message) + '</p>';
      });
    }

    var searchEl = $('#svcSearch');
    if (searchEl) searchEl.addEventListener('input', function() { searchKey = searchEl.value; load(); });
    var typeEl = $('#svcTypeFilter');
    if (typeEl) typeEl.addEventListener('change', function() { typeFilter = typeEl.value; load(); });
    var statusEl = $('#svcStatusFilter');
    if (statusEl) statusEl.addEventListener('change', function() { statusFilter = statusEl.value; load(); });
    var refreshBtn = $('#refreshSvcBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', load);
    var createBtn = $('#svcCreateBtn');
    if (createBtn) createBtn.addEventListener('click', function() { openServiceForm(null, load); });
    var importBtn = $('#svcImportBtn');
    if (importBtn) importBtn.addEventListener('click', function() {
      if (!confirm('将网址大全中未纳入服务目录的环境批量导入为服务，是否继续？')) return;
      importBtn.disabled = true;
      apiFetch('/services/import-from-envs', { method: 'POST' }).then(function(r) {
        toast('已导入 ' + r.imported + ' 个服务，跳过 ' + r.skipped + ' 个已存在', 'success');
        load();
      }).catch(function(e) { toast('导入失败: ' + e.message, 'error'); })
      .finally(function() { importBtn.disabled = false; });
    });
    var exportBtn = $('#svcExportBtn');
    if (exportBtn) exportBtn.addEventListener('click', function() {
      window.open('/api/services/export?token=' + (localStorage.getItem('token') || ''), '_blank');
    });

    load();
  }

  // ============ 新建/编辑服务弹窗 ============
  function openServiceForm(service, onSaved) {
    var isEdit = !!service;
    var s = service || { name: '', code: '', type: 'backend', team: '', description: '', repo_url: '', doc_url: '', api_doc_url: '', port: '', health_check_path: '/health', status: 'active', tech_stack: [], deploy_envs: [], scorecard: {} };
    var users = (appState.data && appState.data.users) || [];
    var userOpts = '<option value="">无</option>' + users.map(function(u) { return '<option value="' + u.id + '"' + (s.owner_id === u.id ? ' selected' : '') + '>' + escHtml(u.username) + '</option>'; }).join('');
    var typeOpts = Object.keys(TYPE_MAP).map(function(k) { return '<option value="' + k + '"' + (s.type === k ? ' selected' : '') + '>' + TYPE_MAP[k].label + '</option>'; }).join('');
    var statusOpts = Object.keys(STATUS_MAP).map(function(k) { return '<option value="' + k + '"' + (s.status === k ? ' selected' : '') + '>' + STATUS_MAP[k].label + '</option>'; }).join('');

    showModal(
      '<h3 style="margin:0 0 12px;"><i class="fa-solid ' + (isEdit ? 'fa-pen' : 'fa-plus') + '"></i> ' + (isEdit ? '编辑服务' : '新建服务') + '</h3>' +
      '<div class="svc-form-grid">' +
        ftext('svcName', '服务名称 *', s.name, '请输入服务名称') +
        ftext('svcCode', '服务代号', s.code || '', '唯一标识，如 user-center') +
        fselect('svcType', '类型', typeOpts) +
        fselect('svcStatus', '状态', statusOpts) +
        ftext('svcTeam', '所属团队', s.team || '', '') +
        fselect('svcOwner', '负责人', userOpts) +
        ftext('svcPort', '端口', s.port || '', '') +
        ftext('svcHealth', '健康检查路径', s.health_check_path || '', '') +
        ftext('svcTech', '技术栈（逗号分隔）', (s.tech_stack || []).join(', '), '') +
        ftext('svcRepo', '代码仓库', s.repo_url || '', '') +
        ftext('svcDoc', '文档地址', s.doc_url || '', '') +
        ftext('svcApiDoc', 'API 文档', s.api_doc_url || '', '') +
      '</div>' +
      '<label style="display:block;margin:8px 0 4px;">描述</label>' +
      '<textarea id="svcDesc" rows="2" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border-color);border-radius:4px;background:var(--input-bg);color:var(--text-color);">' + escHtml(s.description || '') + '</textarea>' +
      '<div style="margin-top:14px;text-align:right;">' +
        '<button class="topbar-btn" id="svcFormCancel" style="margin-right:8px;">取消</button>' +
        '<button class="topbar-btn" id="svcFormSave" style="background:var(--primary-color);color:#fff;">保存</button>' +
      '</div>'
    );

    function ftext(id, label, val, ph) {
      return '<div style="margin-bottom:8px;"><label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:2px;">' + label + '</label>' +
        '<input id="' + id + '" value="' + escHtml(String(val || '')) + '" placeholder="' + escHtml(ph) + '" style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;background:var(--input-bg);color:var(--text-color);"></div>';
    }
    function fselect(id, label, opts) {
      return '<div style="margin-bottom:8px;"><label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:2px;">' + label + '</label>' +
        '<select id="' + id + '" style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;background:var(--input-bg);color:var(--text-color);">' + opts + '</select></div>';
    }

    $('#svcFormCancel').addEventListener('click', closeModal);
    $('#svcFormSave').addEventListener('click', function() {
      var name = $('#svcName').value.trim();
      if (!name) { toast('请输入服务名称', 'error'); return; }
      var body = {
        name: name,
        code: $('#svcCode').value.trim(),
        type: $('#svcType').value,
        status: $('#svcStatus').value,
        team: $('#svcTeam').value.trim(),
        port: $('#svcPort').value ? parseInt($('#svcPort').value, 10) : null,
        health_check_path: $('#svcHealth').value.trim(),
        repo_url: $('#svcRepo').value.trim(),
        doc_url: $('#svcDoc').value.trim(),
        api_doc_url: $('#svcApiDoc').value.trim(),
        description: $('#svcDesc').value,
        tech_stack: $('#svcTech').value.split(',').map(function(t) { return t.trim(); }).filter(Boolean)
      };
      var ownerVal = $('#svcOwner').value;
      if (ownerVal) body.owner_id = parseInt(ownerVal, 10);
      var btn = this;
      btn.disabled = true; btn.textContent = '保存中…';
      var url = '/services' + (isEdit ? '/' + s.id : '');
      var method = isEdit ? 'PUT' : 'POST';
      apiFetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function() { toast(isEdit ? '已更新' : '已创建', 'success'); closeModal(); if (onSaved) onSaved(); })
        .catch(function(e) { toast('保存失败: ' + e.message, 'error'); btn.disabled = false; btn.textContent = '保存'; });
    });
  }

  // ============ 服务详情 ============
  function renderServiceDetail(content) {
    if (!appState.currentUser) {
      content.innerHTML = '<div class="empty-state"><i class="fa-solid fa-lock"></i><p>请先登录</p></div>';
      return;
    }
    var sid = _currentServiceId;
    if (!sid) { TA.navigateTo('services'); return; }
    var canModify = hasPermission('modify');
    var canDelete = hasPermission('delete');

    content.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">' +
        '<button class="topbar-btn" id="svcBackBtn"><i class="fa-solid fa-arrow-left"></i> 返回</button>' +
        '<h2 class="page-title" id="svcDetailTitle" style="margin:0;">加载中…</h2>' +
      '</div>' +
      '<div id="svcDetailBody">加载中…</div>';

    $('#svcBackBtn').addEventListener('click', function() { TA.navigateTo('services'); });

    function loadDetail() {
      Promise.all([
        apiFetch('/services/' + sid),
        apiFetch('/services/' + sid + '/dependencies')
      ]).then(function(results) {
        var s = results[0];
        var deps = results[1];
        renderDetailBody(s, deps);
      }).catch(function(e) {
        $('#svcDetailBody').innerHTML = '<p style="color:#dc2626;padding:16px;">加载失败: ' + escHtml(e.message) + '</p>';
      });
    }

    function renderDetailBody(s, deps) {
      $('#svcDetailTitle').innerHTML = '<i class="fa-solid ' + (TYPE_MAP[s.type] ? TYPE_MAP[s.type].icon : 'fa-cube') + '"></i> ' + escHtml(s.name);
      var score = s.scorecard ? s.scorecard.score : 0;
      var envs = (appState.data && appState.data.envs) || [];
      var envMap = {}; envs.forEach(function(e) { envMap[e.id] = e; });

      var body = $('#svcDetailBody');
      body.innerHTML =
        '<div class="svc-detail-grid">' +
          // 左列：基本信息 + 评分卡
          '<div class="svc-detail-col">' +
            '<div class="svc-panel">' +
              '<div class="svc-panel-head"><i class="fa-solid fa-circle-info"></i> 基本信息' +
                '<span style="margin-left:auto;">' + statusBadge(s.status) + typeBadge(s.type) + '</span>' +
              '</div>' +
              '<table class="svc-info-table">' +
                infoRow('服务代号', s.code || '-') +
                infoRow('所属团队', s.team || '-') +
                infoRow('负责人', s.owner_name || '-') +
                infoRow('端口', s.port || '-') +
                infoRow('健康检查', s.health_check_path || '-') +
                infoRow('创建时间', s.created_at ? formatDate(s.created_at) : '-') +
                infoRow('更新时间', s.updated_at ? formatDate(s.updated_at) : '-') +
              '</table>' +
              (s.description ? '<div style="margin-top:8px;padding:8px;background:var(--input-bg);border-radius:4px;font-size:13px;">' + escHtml(s.description) + '</div>' : '') +
              '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">' +
                linkBtn('svcRepoLink', 'fa-code', '代码仓库', s.repo_url) +
                linkBtn('svcDocLink', 'fa-book', '文档', s.doc_url) +
                linkBtn('svcApiDocLink', 'fa-plug', 'API 文档', s.api_doc_url) +
              '</div>' +
              (s.tech_stack && s.tech_stack.length ? '<div style="margin-top:10px;"><div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">技术栈</div>' +
                s.tech_stack.map(function(t) { return '<span class="svc-chip">' + escHtml(t) + '</span>'; }).join('') + '</div>' : '') +
              '<div style="margin-top:10px;display:flex;gap:8px;">' +
                (canModify ? '<button class="topbar-btn" id="svcEditBtn"><i class="fa-solid fa-pen"></i> 编辑</button>' : '') +
                (canDelete ? '<button class="topbar-btn" id="svcDelBtn" style="color:#dc2626;"><i class="fa-solid fa-trash"></i> 删除</button>' : '') +
              '</div>' +
            '</div>' +
            // 评分卡
            '<div class="svc-panel" style="margin-top:12px;">' +
              '<div class="svc-panel-head"><i class="fa-solid fa-clipboard-check"></i> 生产就绪评分卡' +
                '<span class="svc-score-big" style="color:' + scoreColor(score) + ';">' + score + ' / 100</span>' +
              '</div>' +
              '<div class="svc-scorecard">' +
                SCORECARD_ITEMS.map(function(item) {
                  var checked = s.scorecard && s.scorecard[item.key] ? ' checked' : '';
                  var dis = canModify ? '' : ' disabled';
                  return '<label class="svc-scorecard-item' + (checked ? ' on' : '') + '">' +
                    '<input type="checkbox" data-key="' + item.key + '"' + checked + dis + '>' +
                    '<span>' + escHtml(item.label) + '</span>' +
                    '<span class="svc-scorecard-pts">+20</span>' +
                  '</label>';
                }).join('') +
              '</div>' +
            '</div>' +
            // 部署环境
            '<div class="svc-panel" style="margin-top:12px;">' +
              '<div class="svc-panel-head"><i class="fa-solid fa-server"></i> 部署环境</div>' +
              '<div id="svcDeployEnvs">' + (s.deploy_envs && s.deploy_envs.length ? s.deploy_envs.map(function(eid) {
                var e = envMap[eid];
                var nm = e ? (e.name || e.ip || ('env#' + eid)) : ('env#' + eid + ' (已删除)');
                return '<span class="svc-chip svc-env-chip" data-eid="' + eid + '"><i class="fa-solid fa-link"></i> ' + escHtml(nm) + '</span>';
              }).join('') : '<span style="color:var(--text-muted);">未关联环境</span>') + '</div>' +
            '</div>' +
          '</div>' +
          // 右列：依赖关系 + 依赖图
          '<div class="svc-detail-col">' +
            '<div class="svc-panel">' +
              '<div class="svc-panel-head"><i class="fa-solid fa-diagram-project"></i> 依赖关系' +
                (canModify ? '<button class="topbar-btn svc-add-dep-btn" style="margin-left:auto;padding:2px 8px;font-size:12px;">添加依赖</button>' : '') +
              '</div>' +
              '<div class="svc-dep-section"><div class="svc-dep-subhead">我依赖谁（出向）</div>' +
                depList(deps.outgoing, 'out', canModify) +
              '</div>' +
              '<div class="svc-dep-section"><div class="svc-dep-subhead">谁依赖我（入向）</div>' +
                depList(deps.incoming, 'in', false) +
              '</div>' +
            '</div>' +
            '<div class="svc-panel" style="margin-top:12px;">' +
              '<div class="svc-panel-head"><i class="fa-solid fa-circle-nodes"></i> 依赖拓扑图</div>' +
              '<div id="svcDepGraph"></div>' +
            '</div>' +
          '</div>' +
        '</div>';

      // 评分卡切换
      if (canModify) {
        body.querySelectorAll('.svc-scorecard-item input[type=checkbox]').forEach(function(cb) {
          cb.addEventListener('change', function() {
            var sc = {};
            body.querySelectorAll('.svc-scorecard-item input[type=checkbox]').forEach(function(c) {
              sc[c.getAttribute('data-key')] = c.checked;
            });
            apiFetch('/services/' + sid, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scorecard: sc }) })
              .then(function(updated) {
                toast('评分已更新: ' + updated.scorecard.score + ' 分', 'success');
                loadDetail();
              }).catch(function(e) { toast('更新失败: ' + e.message, 'error'); loadDetail(); });
          });
        });
        var editBtn = $('#svcEditBtn');
        if (editBtn) editBtn.addEventListener('click', function() { openServiceForm(s, loadDetail); });
        var delBtn = $('#svcDelBtn');
        if (delBtn) delBtn.addEventListener('click', function() {
          if (!confirm('确定删除服务「' + s.name + '」？相关依赖将一并移除。')) return;
          apiFetch('/services/' + sid, { method: 'DELETE' }).then(function() {
            toast('服务已删除', 'success'); TA.navigateTo('services');
          }).catch(function(e) { toast('删除失败: ' + e.message, 'error'); });
        });
        var addDepBtn = body.querySelector('.svc-add-dep-btn');
        if (addDepBtn) addDepBtn.addEventListener('click', function() { openDepForm(sid, loadDetail); });
        // 移除依赖
        body.querySelectorAll('.svc-dep-remove').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var depId = btn.getAttribute('data-dep');
            apiFetch('/services/' + sid + '/dependencies/' + depId, { method: 'DELETE' })
              .then(function() { toast('依赖已移除', 'success'); loadDetail(); })
              .catch(function(e) { toast('移除失败: ' + e.message, 'error'); });
          });
        });
      }
      // 部署环境点击 → 跳转网址大全
      body.querySelectorAll('.svc-env-chip').forEach(function(chip) {
        chip.addEventListener('click', function() { TA.navigateTo('urls'); });
      });
      // 依赖节点点击 → 跳转对应服务详情
      body.querySelectorAll('.svc-dep-node').forEach(function(node) {
        node.addEventListener('click', function() {
          _currentServiceId = parseInt(node.getAttribute('data-sid'), 10);
          TA.navigateTo('service-detail');
          loadDetail();
        });
      });
      // 渲染依赖拓扑图
      renderDepGraph(s, deps);
    }

    function infoRow(label, val) {
      return '<tr><td style="padding:4px 12px 4px 0;color:var(--text-muted);white-space:nowrap;">' + escHtml(label) + '</td><td style="padding:4px 0;">' + escHtml(String(val)) + '</td></tr>';
    }
    function linkBtn(id, icon, label, url) {
      if (!url) return '';
      return '<a href="' + escHtml(url) + '" target="_blank" class="topbar-btn" style="text-decoration:none;font-size:12px;"><i class="fa-solid ' + icon + '"></i> ' + escHtml(label) + '</a>';
    }
    function depList(list, dir, canRemove) {
      if (!list || !list.length) return '<p style="color:var(--text-muted);font-size:13px;padding:4px 0;">无</p>';
      return list.map(function(d) {
        return '<div class="svc-dep-row">' +
          '<span class="svc-dep-node" data-sid="' + d.service_id + '"><i class="fa-solid fa-cube"></i> ' + escHtml(d.service_name) + '</span>' +
          '<span class="svc-dep-type svc-dep-type-' + escHtml(d.type || '') + '">' + escHtml(DEP_TYPE_MAP[d.type] || d.type || '-') + '</span>' +
          (d.description ? '<span class="svc-dep-desc">' + escHtml(d.description) + '</span>' : '') +
          (canRemove ? '<button class="svc-dep-remove" data-dep="' + d.id + '" title="移除"><i class="fa-solid fa-xmark"></i></button>' : '') +
        '</div>';
      }).join('');
    }

    loadDetail();
  }

  // ============ 添加依赖弹窗 ============
  function openDepForm(sid, onSaved) {
    apiFetch('/services').then(function(res) {
      var services = ((res && res.services) || []).filter(function(s) { return s.id !== sid; });
      var opts = services.map(function(s) { return '<option value="' + s.id + '">' + escHtml(s.name) + (s.code ? ' (' + escHtml(s.code) + ')' : '') + '</option>'; }).join('');
      showModal(
        '<h3 style="margin:0 0 12px;"><i class="fa-solid fa-diagram-project"></i> 添加依赖</h3>' +
        '<label style="display:block;margin-bottom:6px;">依赖的服务</label>' +
        '<select id="depTarget" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border-color);border-radius:4px;background:var(--input-bg);color:var(--text-color);margin-bottom:12px;">' + opts + '</select>' +
        '<label style="display:block;margin-bottom:6px;">依赖类型</label>' +
        '<select id="depType" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border-color);border-radius:4px;background:var(--input-bg);color:var(--text-color);margin-bottom:12px;">' +
          Object.keys(DEP_TYPE_MAP).map(function(k) { return '<option value="' + k + '">' + DEP_TYPE_MAP[k] + '</option>'; }).join('') +
        '</select>' +
        '<label style="display:block;margin-bottom:6px;">说明（选填）</label>' +
        '<input id="depDesc" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border-color);border-radius:4px;background:var(--input-bg);color:var(--text-color);margin-bottom:14px;" placeholder="例如：调用其鉴权接口">' +
        '<div style="text-align:right;">' +
          '<button class="topbar-btn" id="depCancel" style="margin-right:8px;">取消</button>' +
          '<button class="topbar-btn" id="depSave" style="background:var(--primary-color);color:#fff;">添加</button>' +
        '</div>'
      );
      $('#depCancel').addEventListener('click', closeModal);
      $('#depSave').addEventListener('click', function() {
        var target = parseInt($('#depTarget').value, 10);
        if (!target) { toast('请选择服务', 'error'); return; }
        var btn = this; btn.disabled = true;
        apiFetch('/services/' + sid + '/dependencies', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to_service_id: target, type: $('#depType').value, description: $('#depDesc').value.trim() })
        }).then(function() { toast('依赖已添加', 'success'); closeModal(); if (onSaved) onSaved(); })
          .catch(function(e) { toast('添加失败: ' + e.message, 'error'); btn.disabled = false; });
      });
    }).catch(function(e) { toast('加载服务列表失败: ' + e.message, 'error'); });
  }

  // ============ 依赖拓扑图（纯 SVG）============
  function renderDepGraph(service, deps) {
    var container = $('#svcDepGraph');
    if (!container) return;
    var outgoing = deps.outgoing || [];
    var incoming = deps.incoming || [];
    if (!outgoing.length && !incoming.length) {
      container.innerHTML = '<p style="color:var(--text-muted);padding:16px;text-align:center;">暂无依赖关系</p>';
      return;
    }
    // 布局：左列=入向（谁依赖我），中=当前服务，右列=出向（我依赖谁）
    var W = 560, H = Math.max(200, Math.max(outgoing.length, incoming.length) * 56 + 80);
    var cx = W / 2, cy = H / 2;
    var leftX = 70, rightX = W - 70;
    var nodeW = 120, nodeH = 36;

    function nodePos(list, x) {
      var n = list.length;
      return list.map(function(d, i) {
        var y = n === 1 ? cy : (H / (n + 1)) * (i + 1);
        return { d: d, x: x, y: y };
      });
    }
    var leftNodes = nodePos(incoming, leftX);
    var rightNodes = nodePos(outgoing, rightX);

    var svg = '<svg width="100%" viewBox="0 0 ' + W + ' ' + H + '" style="max-height:360px;" xmlns="http://www.w3.org/2000/svg">';
    // 边
    function edge(from, to, color) {
      var mx = (from.x + to.x) / 2;
      return '<path d="M ' + from.x + ' ' + from.y + ' C ' + mx + ' ' + from.y + ', ' + mx + ' ' + to.y + ', ' + to.x + ' ' + to.y + '" stroke="' + color + '" stroke-width="1.5" fill="none" marker-end="url(#arrow-' + color.replace('#','') + ')"/>';
    }
    svg += '<defs>';
    ['#3b82f6', '#f59e0b'].forEach(function(c) {
      svg += '<marker id="arrow-' + c.replace('#','') + '" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="' + c + '"/></marker>';
    });
    svg += '</defs>';
    // 入向边：left → center (蓝)
    leftNodes.forEach(function(n) { svg += edge(n, { x: cx - nodeW/2, y: cy }, '#3b82f6'); });
    // 出向边：center → right (橙)
    rightNodes.forEach(function(n) { svg += edge({ x: cx + nodeW/2, y: cy }, n, '#f59e0b'); });
    // 节点
    function nodeBox(x, y, name, fill, sid, clickable) {
      var nx = x - nodeW / 2, ny = y - nodeH / 2;
      return '<g' + (clickable ? ' class="svc-gnode" data-sid="' + sid + '" style="cursor:pointer;"' : '') + '>' +
        '<rect x="' + nx + '" y="' + ny + '" width="' + nodeW + '" height="' + nodeH + '" rx="6" fill="' + fill + '" stroke="' + fill + '" stroke-width="1" opacity="0.15"/>' +
        '<rect x="' + nx + '" y="' + ny + '" width="' + nodeW + '" height="' + nodeH + '" rx="6" fill="none" stroke="' + fill + '" stroke-width="1.5"/>' +
        '<text x="' + x + '" y="' + y + '" text-anchor="middle" dominant-baseline="central" font-size="12" fill="currentColor" style="pointer-events:none;">' + escHtml(name.length > 8 ? name.slice(0,7)+'…' : name) + '</text>' +
      '</g>';
    }
    leftNodes.forEach(function(n) { svg += nodeBox(n.x, n.y, n.d.service_name, '#3b82f6', n.d.service_id, true); });
    rightNodes.forEach(function(n) { svg += nodeBox(n.x, n.y, n.d.service_name, '#f59e0b', n.d.service_id, true); });
    svg += nodeBox(cx, cy, service.name, '#10b981', service.id, false);
    // 图例
    svg += '<g transform="translate(10,' + (H - 18) + '" font-size="11" fill="var(--text-muted)">' +
      '<circle cx="6" cy="0" r="4" fill="#3b82f6"/><text x="16" y="3">谁依赖我</text>' +
      '<circle cx="90" cy="0" r="4" fill="#f59e0b"/><text x="100" y="3">我依赖谁</text>' +
    '</g>';
    svg += '</svg>';
    container.innerHTML = svg;
    // 节点点击跳转
    container.querySelectorAll('.svc-gnode').forEach(function(g) {
      g.addEventListener('click', function() {
        _currentServiceId = parseInt(g.getAttribute('data-sid'), 10);
        TA.navigateTo('service-detail');
      });
    });
  }

  TA.renderServices = renderServices;
  TA.renderServiceDetail = renderServiceDetail;
})();
