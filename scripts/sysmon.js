/* ═══════════════════════════════════════════════════════════════
   SYSTEM MONITOR — Live browser performance telemetry
   Reads from Performance API, Navigator API, and PerformanceObserver.
   All data is read-only and never transmitted.
   ═══════════════════════════════════════════════════════════════ */
/* global performance, PerformanceObserver, screen */
(function () {
  'use strict';

  /* ── Helpers ─────────────────────────────────────────────────── */
  function fmt(ms) {
    if (ms == null || isNaN(ms)) return '—';
    return ms < 1000
      ? Math.round(ms) + '<span class="sysmon-unit">ms</span>'
      : (ms / 1000).toFixed(2) + '<span class="sysmon-unit">s</span>';
  }

  function fmtBytes(bytes) {
    if (bytes == null || isNaN(bytes)) return '—';
    if (bytes < 1024) return bytes + '<span class="sysmon-unit">B</span>';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + '<span class="sysmon-unit">KB</span>';
    return (bytes / 1048576).toFixed(2) + '<span class="sysmon-unit">MB</span>';
  }

  function set(id, html) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function badge(ms, good, ok) {
    if (ms == null || isNaN(ms)) return '';
    if (ms <= good) return '<span class="sysmon-badge sysmon-badge--good">GOOD</span>';
    if (ms <= ok)   return '<span class="sysmon-badge sysmon-badge--ok">OK</span>';
    return '<span class="sysmon-badge sysmon-badge--poor">POOR</span>';
  }

  /* ── Page Load Timing (Navigation Timing API) ────────────────── */
  function collectNavTiming() {
    var entries = performance.getEntriesByType('navigation');
    if (!entries || !entries.length) return;
    var nav = entries[0];

    var ttfb = nav.responseStart - nav.requestStart;
    set('metric-ttfb', fmt(ttfb) + badge(ttfb, 200, 600));
    set('metric-dom-interactive', fmt(nav.domInteractive));
    set('metric-dom-complete', fmt(nav.domComplete));
    set('metric-load', fmt(nav.loadEventEnd) + badge(nav.loadEventEnd, 2000, 4000));
  }

  /* ── Web Vitals via PerformanceObserver ──────────────────────── */
  function observeVitals() {
    // FCP
    try {
      var fcpObs = new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].name === 'first-contentful-paint') {
            var v = entries[i].startTime;
            set('metric-fcp', fmt(v) + badge(v, 1800, 3000));
            fcpObs.disconnect();
          }
        }
      });
      fcpObs.observe({ type: 'paint', buffered: true });
    } catch (ignore) { void ignore; }

    // LCP
    try {
      var lcpObs = new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        if (entries.length) {
          var v = entries[entries.length - 1].startTime;
          set('metric-lcp', fmt(v) + badge(v, 2500, 4000));
        }
      });
      lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (ignore) { void ignore; }

    // CLS
    try {
      var clsValue = 0;
      var clsObs = new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        for (var i = 0; i < entries.length; i++) {
          if (!entries[i].hadRecentInput) {
            clsValue += entries[i].value;
          }
        }
        var label = clsValue.toFixed(3);
        var clsBadge = clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'ok' : 'poor';
        set('metric-cls', label + '<span class="sysmon-badge sysmon-badge--' + clsBadge + '">' + clsBadge.toUpperCase() + '</span>');
      });
      clsObs.observe({ type: 'layout-shift', buffered: true });
    } catch (ignore) { void ignore; }
  }

  /* ── Resource count & transfer size ──────────────────────────── */
  function collectResources() {
    var resources = performance.getEntriesByType('resource');
    set('metric-resources', resources.length + '<span class="sysmon-unit">files</span>');

    var totalTransfer = 0;
    for (var i = 0; i < resources.length; i++) {
      totalTransfer += resources[i].transferSize || 0;
    }
    set('metric-transfer', fmtBytes(totalTransfer));
  }

  /* ── Hardware ────────────────────────────────────────────────── */
  function collectHardware() {
    set('metric-cores', navigator.hardwareConcurrency || '—');
    set('metric-device-mem', navigator.deviceMemory
      ? navigator.deviceMemory + '<span class="sysmon-unit">GB</span>'
      : 'N/A');
    set('metric-screen', screen.width + '×' + screen.height);
    set('metric-dpr', (window.devicePixelRatio || 1).toFixed(1) + '×');
  }

  /* ── Network & Runtime ───────────────────────────────────────── */
  function collectNetwork() {
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      set('metric-connection', conn.effectiveType ? conn.effectiveType.toUpperCase() : '—');
      set('metric-downlink', conn.downlink != null
        ? conn.downlink + '<span class="sysmon-unit">Mbps</span>'
        : '—');
    } else {
      set('metric-connection', 'N/A');
      set('metric-downlink', 'N/A');
    }

    // JS Heap (Chrome/Edge only)
    if (performance.memory) {
      set('metric-heap', fmtBytes(performance.memory.usedJSHeapSize));
    } else {
      set('metric-heap', 'N/A');
    }
  }

  /* ── Init ────────────────────────────────────────────────────── */
  function init() {
    collectHardware();
    collectNetwork();
    observeVitals();

    // Nav timing + resources need the load event to be complete
    if (document.readyState === 'complete') {
      collectNavTiming();
      collectResources();
    } else {
      window.addEventListener('load', function () {
        // small delay to ensure loadEventEnd is populated
        setTimeout(function () {
          collectNavTiming();
          collectResources();
        }, 100);
      });
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
