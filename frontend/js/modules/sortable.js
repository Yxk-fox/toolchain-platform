/* eslint-disable */
/**
 * sortable.js — 轻量拖拽排序模块（桌面鼠标 + 移动触摸统一 Pointer Events 实现）
 *
 * 用法:
 *   var s = Sortable.create(container, {
 *     itemSelector:   '.card',            // 可排序子项（container 直接子元素）
 *     handleSelector: '.drag-handle',    // 拖拽手柄（可选，缺省整项可拖）
 *     onStart: function(item, oldIndex) {},           // 拖拽开始
 *     onMove:  function(item, oldIndex, newIndex) {}, // 占位指示器移动（实时预览）
 *     onEnd:   function(item, oldIndex, newIndex) {}, // 拖拽结束（newIndex 为最终位置）
 *   });
 *   s.destroy();  // 解绑事件
 *
 * 特性:
 *  - 触摸支持: 手柄 touch-action:none，避免拖动时页面滚动
 *  - 启动阈值 5px: 单击/按钮操作不受影响
 *  - 视觉反馈: 拖拽项高亮为固定定位"幽灵"跟随指针（transform3d + rAF，GPU 合成），
 *              原位置插入虚线占位指示器，越过卡片中点即实时移动（位置预览）
 *  - 边界检测: 指针拖出容器矩形范围时不响应，占位符停留在最后有效位置
 */
(function (global) {
  'use strict';

  var DRAG_THRESHOLD = 5; // px，超过该位移才进入拖拽，避免误拖

  function create(container, opts) {
    opts = opts || {};
    var itemSelector = opts.itemSelector || ':scope > *';
    var handleSelector = opts.handleSelector || null;

    var items = function () {
      var out = [];
      for (var i = 0; i < container.children.length; i++) {
        var c = container.children[i];
        if (c.matches(itemSelector)) out.push(c);
      }
      return out;
    };

    var state = null; // 当前拖拽会话

    function indexOfItem(list, item) {
      for (var i = 0; i < list.length; i++) if (list[i] === item) return i;
      return -1;
    }

    function onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return; // 仅主键
      var item = e.target.closest ? e.target.closest(itemSelector) : null;
      if (!item || !container.contains(item)) return;
      if (handleSelector && !e.target.closest(handleSelector)) return;
      if (state) return;

      state = {
        item: item,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        started: false,
        placeholder: null,
        startIndex: -1,
        index: -1,
        rects: [],
        rafPending: false,
        lastX: e.clientX,
        lastY: e.clientY,
        destroyed: false
      };

      // 手柄捕获指针：移动/抬起事件稳定送达，即使指针离开手柄区域
      var handle = e.target.closest ? (e.target.closest(handleSelector || itemSelector)) : null;
      if (handle && handle.setPointerCapture) {
        try { handle.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('pointercancel', onPointerUp);
      e.preventDefault(); // 防止触摸长按选中文本/图像拖拽
    }

    function cacheRects() {
      state.rects = items().filter(function (el) { return el !== state.item; })
        .map(function (el) {
          var r = el.getBoundingClientRect();
          return { el: el, left: r.left, top: r.top, right: r.right, bottom: r.bottom, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
        });
    }

    function startDrag() {
      var item = state.item;
      var rect = item.getBoundingClientRect();
      state.started = true;
      state.startIndex = indexOfItem(items(), item);
      state.index = state.startIndex;

      var ph = document.createElement('div');
      ph.className = 'sortable-placeholder';
      ph.style.width = rect.width + 'px';
      ph.style.height = rect.height + 'px';
      item.parentNode.insertBefore(ph, item);
      state.placeholder = ph;

      // 幽灵：原项转为固定定位跟随指针，占位符留在流中标记落点
      item.classList.add('sortable-dragging');
      item.style.width = rect.width + 'px';
      item.style.height = rect.height + 'px';
      item.style.position = 'fixed';
      item.style.left = rect.left + 'px';
      item.style.top = rect.top + 'px';
      item.style.margin = '0';
      item.style.zIndex = '999';
      item.style.pointerEvents = 'none';
      item.style.transform = 'translate3d(0,0,0)';
      document.body.classList.add('sortable-active');

      cacheRects();
      if (opts.onStart) opts.onStart(item, state.startIndex);
    }

    function computeTargetIndex(x, y) {
      // 边界检测：指针拖出容器范围（含 40px 容差）时保持原位置
      var cr = container.getBoundingClientRect();
      if (x < cr.left - 40 || x > cr.right + 40 || y < cr.top - 40 || y > cr.bottom + 40) return state.index;
      // 找指针所在的目标项，按主轴中点决定插前/插后
      var target = null, before = false;
      for (var i = 0; i < state.rects.length; i++) {
        var r = state.rects[i];
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          target = r; break;
        }
      }
      if (target) {
        var horizontal = (x < target.cx);
        var vertical = (y < target.cy);
        before = (Math.abs(x - target.cx) > Math.abs(y - target.cy)) ? horizontal : vertical;
        var domIndex = indexOfItem(items(), target.el);
        return before ? domIndex : domIndex + 1;
      }
      return state.index;
    }

    function movePlaceholder(newIndex) {
      var ph = state.placeholder;
      var list = items();
      if (newIndex >= list.length) {
        container.appendChild(ph);
      } else {
        container.insertBefore(ph, list[newIndex]);
      }
      cacheRects();
      if (opts.onMove) opts.onMove(state.item, state.startIndex, newIndex);
    }

    function onPointerMove(e) {
      if (!state || e.pointerId !== state.pointerId) return;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      if (!state.started) {
        var dx = e.clientX - state.startX, dy = e.clientY - state.startY;
        if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;
        startDrag();
      }
      if (state.rafPending) return;
      state.rafPending = true;
      requestAnimationFrame(function () {
        state.rafPending = false;
        if (!state || !state.started) return;
        // 幽灵跟随指针：transform3d 合成层更新，不掉帧
        var tx = state.lastX - state.startX;
        var ty = state.lastY - state.startY;
        state.item.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0)';
        // 占位指示器位置预览
        var newIndex = computeTargetIndex(state.lastX, state.lastY);
        if (newIndex !== state.index) {
          state.index = newIndex;
          movePlaceholder(newIndex);
        }
      });
    }

    function onPointerUp(e) {
      if (!state || (e && e.pointerId !== undefined && e.pointerId !== state.pointerId)) return;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
      document.body.classList.remove('sortable-active');

      if (!state.started) { state = null; return; }
      var item = state.item;
      var ph = state.placeholder;
      var oldIndex = state.startIndex;
      // 计算落点：占位符当前所处位置
      var newIndex = 0;
      for (var i = 0; i < container.children.length; i++) {
        if (container.children[i] === ph) break;
        if (container.children[i].matches(itemSelector)) newIndex++;
      }
      // 还原幽灵样式并插回占位符位置
      item.classList.remove('sortable-dragging');
      item.style.width = ''; item.style.height = '';
      item.style.position = ''; item.style.left = ''; item.style.top = '';
      item.style.margin = ''; item.style.zIndex = ''; item.style.pointerEvents = '';
      item.style.transform = '';
      container.insertBefore(item, ph);
      if (ph.parentNode) ph.parentNode.removeChild(ph);
      state = null;
      if (opts.onEnd) opts.onEnd(item, oldIndex, newIndex);
    }

    container.addEventListener('pointerdown', onPointerDown);

    return {
      destroy: function () {
        container.removeEventListener('pointerdown', onPointerDown);
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('pointercancel', onPointerUp);
        state = null;
      }
    };
  }

  global.Sortable = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);
