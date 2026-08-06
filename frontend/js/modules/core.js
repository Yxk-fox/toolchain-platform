/*
@File    :  core.js
@Time    :  2026/08/05 17:15:16
@Author  :  fox
@Version :  4.0
@Desc    :  ToolchainApp公共核心模块，提供全局命名空间、appState状态管理、
           公共工具函数、常量定义，供app.js和其他modules共享，避免循环依赖
*/
(function() {
  'use strict';

  var API_BASE = '/api';
  var WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws/status';

  var appState = {
    data: { envs: [], tools: [], categories: {}, favorites: { envs: [], tools: [] }, history: [], settings: {}, quickEntries: [], envGroups: [], toolboxGroups: [], mineGroups: [], menuOrder: [], scripts: [], programs: [], programCategories: [] },
    envStatuses: {},
    wsConnected: false,
    currentOs: 'windows',
    currentCategory: '',
    toolView: 'grid',
    theme: 'light',
    primaryColor: '#4f46e5',
    authToken: null,
    currentUser: null,
    hideOfflineEnvs: false
  };

  var PAGE_CONFIG = {
    home:      { name: '首页',          icon: 'fa-house' },
    urls:      { name: '网址大全',      icon: 'fa-earth-asia' },
    services:  { name: '服务目录',      icon: 'fa-sitemap' },
    tools:     { name: '软件管家',      icon: 'fa-screwdriver-wrench' },
    programs:  { name: '自研程序',      icon: 'fa-cube' },
    toolbox:   { name: '工具箱',        icon: 'fa-toolbox' },
    favorites: { name: '我的收藏',      icon: 'fa-star' },
    alerts:    { name: '告警中心',      icon: 'fa-bell' },
    recycle:   { name: '资源回收',      icon: 'fa-recycle' },
    api:       { name: 'REST API 管理', icon: 'fa-satellite-dish' },
    settings:  { name: '系统设置',      icon: 'fa-gear' },
    users:     { name: '用户管理',      icon: 'fa-users' }
  };
  var DEFAULT_MENU_ORDER = ['home', 'urls', 'services', 'tools', 'programs', 'toolbox', 'favorites', 'alerts', 'recycle', 'api', 'settings', 'users'];
  var ADMIN_PAGES = ['users', 'settings'];
  var DEFAULT_USER_PAGES = ["home", "urls", "tools", "toolbox", "favorites", "programs"];

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function toast(msg, type) {
    type = type || 'info';
    var container = $('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(function() { el.remove(); }, 3000);
  }

  // apiFetch 内部 401 时调用 updateTopbarUser（在 theme.js 中定义），
  // 通过 ToolchainApp.updateTopbarUser 延迟解析，避免循环依赖。
  function apiFetch(path, options) {
    options = options || {};
    if (!options.headers) options.headers = {};
    if (appState.authToken) {
      options.headers['Authorization'] = 'Bearer ' + appState.authToken;
    }
    var isFormData = options.body instanceof FormData;
    if (!options.headers['Content-Type'] && options.method && options.method !== 'GET' && !isFormData) {
      options.headers['Content-Type'] = 'application/json';
    }
    return fetch(API_BASE + path, options).then(function(res) {
      if (res.status === 401) {
        appState.authToken = null;
        appState.currentUser = null;
        localStorage.removeItem('tcp_token');
        localStorage.removeItem('tcp_user');
        if (typeof ToolchainApp.updateTopbarUser === 'function') ToolchainApp.updateTopbarUser();
        // 仅写操作（非 GET）触发的 401 才跳登录；GET 浏览不跳转，避免未登录浏览网址大全被踢
        if (options.method && options.method !== 'GET') {
          window.location.href = '/login.html';
        }
        throw new Error('Authentication required');
      }
      if (!res.ok) {
        return res.json().catch(function() { return { detail: 'Request failed' }; }).then(function(err) {
          throw new Error(err.detail || 'Request failed');
        });
      }
      return res.json();
    });
  }

  function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getUserDisplayName(user) {
    if (!user) return '用户';
    return user.display_name && user.display_name.trim() ? user.display_name : user.username;
  }

  function formatDate(isoStr) {
    try {
      var d = new Date(isoStr);
      var now = new Date();
      var diff = now - d;
      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return Math.floor(diff/60000) + '分钟前';
      if (diff < 86400000) return Math.floor(diff/3600000) + '小时前';
      var month = (d.getMonth()+1).toString().padStart(2,'0');
      var day = d.getDate().toString().padStart(2,'0');
      var hour = d.getHours().toString().padStart(2,'0');
      var min = d.getMinutes().toString().padStart(2,'0');
      return month + '-' + day + ' ' + hour + ':' + min;
    } catch(e) {
      return isoStr;
    }
  }

  function getNowString() {
    var d = new Date();
    var weekdays = ['日','一','二','三','四','五','六'];
    var y = d.getFullYear();
    var m = (d.getMonth()+1).toString().padStart(2,'0');
    var day = d.getDate().toString().padStart(2,'0');
    var w = weekdays[d.getDay()];
    var h = d.getHours().toString().padStart(2,'0');
    var min = d.getMinutes().toString().padStart(2,'0');
    var s = d.getSeconds().toString().padStart(2,'0');
    return y + '年' + m + '月' + day + '日 星期' + w + ' ' + h + ':' + min + ':' + s;
  }

  function hasPermission(action) {
    if (!appState.currentUser) return false;
    if (appState.currentUser.role === 'superadmin') return true;
    return (appState.currentUser.permissions || []).indexOf(action) !== -1;
  }

  // 暴露到全局命名空间
  window.ToolchainApp = {
    API_BASE: API_BASE,
    WS_URL: WS_URL,
    appState: appState,
    PAGE_CONFIG: PAGE_CONFIG,
    DEFAULT_MENU_ORDER: DEFAULT_MENU_ORDER,
    ADMIN_PAGES: ADMIN_PAGES,
    DEFAULT_USER_PAGES: DEFAULT_USER_PAGES,
    $: $,
    $$: $$,
    toast: toast,
    apiFetch: apiFetch,
    escHtml: escHtml,
    getUserDisplayName: getUserDisplayName,
    formatDate: formatDate,
    getNowString: getNowString,
    hasPermission: hasPermission
  };
})();
