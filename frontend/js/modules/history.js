/*
@File    :  history.js
@Time    :  2026/08/05 17:15:16
@Author  :  fox
@Version :  4.0
@Desc    :  T2.3巡检历史与可用率统计模块，支持7/30/90天维度切换、环境筛选，
           提供首页可用率折线图渲染，依赖ToolchainApp核心命名空间
*/
(function() {
  'use strict';

  var TA = window.ToolchainApp;
  if (!TA) { console.error('[history.js] ToolchainApp 命名空间未就绪'); return; }
  var $ = TA.$;
  var $$ = TA.$$;
  var apiFetch = TA.apiFetch;
  var escHtml = TA.escHtml;
  var toast = TA.toast;

  var chartState = {
    days: 7,
    envId: null,
    envs: [],
    container: null,
    summaryEl: null,
    chartEl: null,
    envSelect: null,
    daysBtns: []
  };

  /**
   * 在首页容器渲染可用率折线图 + 维度切换 + 环境筛选。
   * @param {HTMLElement} container 渲染目标容器
   */
  function renderUptimeChart(container) {
    chartState.container = container;
    container.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">' +
      '<h3 class="page-title" style="font-size:16px;margin:0;"><i class="fa-solid fa-chart-line"></i> 可用率趋势</h3>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
        '<select id="uptimeEnvFilter" style="padding:4px 8px;border-radius:6px;border:1px solid var(--border-color);font-size:13px;background:var(--bg-color);color:var(--text-color);">' +
          '<option value="">全部环境</option>' +
        '</select>' +
        '<div class="btn-group uptime-days-group" style="display:flex;gap:0;">' +
          '<button class="btn btn-sm uptime-days-btn" data-days="7" style="border-radius:6px 0 0 6px;">7天</button>' +
          '<button class="btn btn-sm uptime-days-btn" data-days="30" style="border-radius:0;border-left:none;border-right:none;">30天</button>' +
          '<button class="btn btn-sm uptime-days-btn" data-days="90" style="border-radius:0 6px 6px 0;">90天</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div id="uptimeSummary" style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px;">加载中…</div>' +
    '<div id="uptimeChart" style="background:var(--card-bg,#fff);border-radius:8px;padding:8px;">加载中…</div>';

    chartState.summaryEl = container.querySelector('#uptimeSummary');
    chartState.chartEl = container.querySelector('#uptimeChart');
    chartState.envSelect = container.querySelector('#uptimeEnvFilter');
    chartState.daysBtns = Array.from(container.querySelectorAll('.uptime-days-btn'));

    updateDaysButtons();
    bindEvents();
    loadData();
  }

  function updateDaysButtons() {
    chartState.daysBtns.forEach(function(btn) {
      var d = parseInt(btn.dataset.days);
      if (d === chartState.days) {
        btn.classList.add('btn-primary');
      } else {
        btn.classList.remove('btn-primary');
      }
    });
  }

  function bindEvents() {
    chartState.daysBtns.forEach(function(btn) {
      btn.onclick = function() {
        chartState.days = parseInt(this.dataset.days);
        updateDaysButtons();
        loadData();
      };
    });
    if (chartState.envSelect) {
      chartState.envSelect.onchange = function() {
        chartState.envId = this.value ? parseInt(this.value) : null;
        loadData();
      };
    }
  }

  function loadData() {
    var params = '?days=' + chartState.days;
    if (chartState.envId) params += '&env_id=' + chartState.envId;
    Promise.all([
      apiFetch('/inspect-history/summary' + params),
      apiFetch('/inspect-history' + params)
    ]).then(function(res) {
      var data = res[0];
      var history = res[1].history || [];
      chartState.envs = data.envs || [];
      updateEnvOptions();
      renderSummary(data.stats, data.current_days);
      renderChart(history, data.current_days);
    }).catch(function(err) {
      if (chartState.summaryEl) chartState.summaryEl.innerHTML = '';
      if (chartState.chartEl) chartState.chartEl.innerHTML = '<p style="color:#dc2626;padding:20px;text-align:center;">可用率数据加载失败: ' + escHtml(err.message) + '</p>';
    });
  }

  function updateEnvOptions() {
    var select = chartState.envSelect;
    if (!select) return;
    var currentVal = chartState.envId ? String(chartState.envId) : '';
    var html = '<option value="">全部环境</option>';
    chartState.envs.forEach(function(e) {
      var sel = String(e.id) === currentVal ? ' selected' : '';
      html += '<option value="' + e.id + '"' + sel + '>' + escHtml(e.name) + '</option>';
    });
    select.innerHTML = html;
  }

  function renderSummary(stats, days) {
    var cardStyle = 'flex:1;min-width:120px;padding:10px;border-radius:8px;background:var(--card-bg,#fff);border:1px solid var(--border-color,#e5e7eb);';
    var numStyle = 'font-size:24px;font-weight:600;';
    var periodLabel = '近 ' + days + ' 天';
    if (!chartState.summaryEl) return;
    chartState.summaryEl.innerHTML =
      card(periodLabel + '可用率', stats.uptime_rate === null ? '—' : stats.uptime_rate + '%', stats.samples + ' 次采样', cardStyle, numStyle) +
      card(periodLabel + '平均在线', stats.avg_online, '平均离线 ' + stats.avg_offline, cardStyle, numStyle) +
      offlineTopCard(stats.offline_top, periodLabel + '离线 Top', cardStyle);
  }

  function card(label, value, sub, style, numStyle) {
    return '<div style="' + style + '">' +
      '<div style="font-size:12px;color:var(--text-muted,#6b7280);">' + label + '</div>' +
      '<div style="' + numStyle + '">' + value + '</div>' +
      '<div style="font-size:11px;color:var(--text-muted,#6b7280);">' + sub + '</div>' +
    '</div>';
  }

  function offlineTopCard(top, label, style) {
    if (!top || !top.length) {
      return '<div style="' + style + '">' +
        '<div style="font-size:12px;color:var(--text-muted,#6b7280);">' + label + '</div>' +
        '<div style="font-size:13px;color:var(--text-muted,#9ca3af);">无离线记录</div>' +
      '</div>';
    }
    var items = top.map(function(t) {
      return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;">' +
        '<span>' + escHtml(t.env_name) + '</span>' +
        '<span style="color:#dc2626;">' + t.count + ' 次</span>' +
      '</div>';
    }).join('');
    return '<div style="' + style + '">' +
      '<div style="font-size:12px;color:var(--text-muted,#6b7280);margin-bottom:4px;">' + label + '</div>' +
      items +
    '</div>';
  }

  /**
   * 纯 SVG 折线图：X 轴时间，Y 轴可用率(0-100%)。
   * 根据days自动调整时间标签格式和数据采样密度
   */
  function renderChart(history, days) {
    var box = chartState.chartEl;
    if (!box) return;
    days = days || 7;
    if (!history.length) {
      box.innerHTML = '<p style="text-align:center;color:var(--text-muted,#9ca3af);padding:20px;">暂无巡检历史数据</p>';
      return;
    }

    var sampled = history;
    var maxPoints = 60;
    if (history.length > maxPoints) {
      var step = Math.ceil(history.length / maxPoints);
      sampled = [];
      for (var i = 0; i < history.length; i += step) {
        sampled.push(history[i]);
      }
      if (sampled[sampled.length - 1] !== history[history.length - 1]) {
        sampled.push(history[history.length - 1]);
      }
    }

    var W = 700, H = 220, PAD_L = 45, PAD_R = 20, PAD_T = 16, PAD_B = 40;
    var innerW = W - PAD_L - PAD_R;
    var innerH = H - PAD_T - PAD_B;
    var n = sampled.length;
    var xs = sampled.map(function(_, i) { return PAD_L + (n === 1 ? innerW / 2 : innerW * i / (n - 1)); });
    function yOf(rate) { return PAD_T + innerH * (1 - rate / 100); }
    var pts = sampled.map(function(h, i) {
      var rate = h.total > 0 ? (h.online / h.total * 100) : 0;
      return { x: xs[i], y: yOf(rate), rate: rate, ts: h.timestamp };
    });
    var pathD = pts.map(function(p, i) { return (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
    var areaD = pathD + ' L' + pts[n - 1].x.toFixed(1) + ',' + (PAD_T + innerH) +
                ' L' + pts[0].x.toFixed(1) + ',' + (PAD_T + innerH) + ' Z';
    var gridLines = [0, 25, 50, 75, 100].map(function(v) {
      var y = yOf(v);
      return '<line x1="' + PAD_L + '" y1="' + y + '" x2="' + (W - PAD_R) + '" y2="' + y + '" stroke="var(--border-color,#e5e7eb)" stroke-width="1" stroke-dasharray="2,3"/>' +
             '<text x="' + (PAD_L - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="var(--text-muted,#6b7280)">' + v + '%</text>';
    }).join('');
    var dots = pts.map(function(p) {
      var color = p.rate >= 99 ? '#16a34a' : (p.rate >= 90 ? '#d97706' : '#dc2626');
      return '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="2.5" fill="' + color + '"><title>' +
        formatTs(p.ts) + '\n可用率: ' + p.rate.toFixed(2) + '%</title></circle>';
    }).join('');

    var xLabels = '';
    var labelCount = 7;
    var labelStep = Math.max(1, Math.floor(n / (labelCount - 1)));
    for (var i = 0; i < n; i += labelStep) {
      var p = pts[i];
      var anchor = i === 0 ? 'start' : (i + labelStep >= n ? 'end' : 'middle');
      xLabels += '<text x="' + p.x + '" y="' + (H - 12) + '" text-anchor="' + anchor + '" font-size="11" fill="var(--text-muted,#6b7280)">' + formatAxisLabel(p.ts, days) + '</text>';
    }
    if (n % labelStep !== 0) {
      var last = pts[n - 1];
      xLabels += '<text x="' + last.x + '" y="' + (H - 12) + '" text-anchor="end" font-size="11" fill="var(--text-muted,#6b7280)">' + formatAxisLabel(last.ts, days) + '</text>';
    }

    box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block;">' +
      gridLines +
      '<path d="' + areaD + '" fill="rgba(79,70,229,0.10)"/>' +
      '<path d="' + pathD + '" fill="none" stroke="#4f46e5" stroke-width="2"/>' +
      dots + xLabels +
    '</svg>';
  }

  function formatAxisLabel(ts, days) {
    if (!ts) return '';
    var d = new Date(ts);
    var mm = d.getMonth() + 1, dd = d.getDate();
    var hh = d.getHours(), mi = d.getMinutes();
    if (days <= 7) {
      return mm + '/' + dd + ' ' + (hh < 10 ? '0' + hh : hh) + ':' + (mi < 10 ? '0' + mi : mi);
    } else if (days <= 30) {
      return mm + '/' + dd;
    } else {
      return mm + '/' + dd;
    }
  }

  function shortTime(ts) {
    return formatAxisLabel(ts, 7);
  }

  function formatTs(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + ' ' +
           pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  TA.renderUptimeChart = renderUptimeChart;
})();
