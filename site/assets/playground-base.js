// Teach AI — shared plumbing every playground page reuses: the
// interrupt-a-running-loop pattern, a sleep helper, and a generic
// localStorage autosave controller. New playgrounds pull these in via
// window.TeachAI.base instead of reimplementing them.
(function () {
  "use strict";

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // A run gets a token when it starts; anything long-running (a training
  // loop, a simulate loop, a delayed animation) captures that token and
  // checks isCurrent() before touching shared state again. Whoever resets
  // the page calls bump(), which silently invalidates every in-flight
  // loop without them needing to know about each other.
  function createRunToken() {
    let current = 0;
    return {
      bump() { return ++current; },
      current() { return current; },
      isCurrent(token) { return token === current; },
    };
  }

  // Generic per-viewer settings autosave, backed by localStorage.
  //   key      — storage key, unique per playground (e.g. "teachai-ga-settings-v1")
  //   els      — the page's element map (id -> DOM element)
  //   fields   — array of keys into `els` whose .value should persist
  //   statusEl — optional element to flash "Autosaved" text into
  //   defaultStatusText — text statusEl reverts to between flashes
  //   onApply(saved) — called after values are written back into the DOM,
  //                    so the page can resync dependent labels/hints/
  //                    visibility (formatting varies per field, so this
  //                    stays page-owned rather than guessed generically)
  //   debounceMs — autosave write delay after the last change (default 400)
  function createAutosave({ key, els, fields, statusEl, defaultStatusText, onApply, debounceMs }) {
    debounceMs = debounceMs || 400;
    let statusTimer = null;

    function flashStatus(text) {
      if (!statusEl) return;
      statusEl.textContent = text;
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => { statusEl.textContent = defaultStatusText || ""; }, 2000);
    }

    function collect() {
      const out = {};
      for (const f of fields) if (els[f]) out[f] = els[f].value;
      return out;
    }

    function saveNow() {
      try {
        localStorage.setItem(key, JSON.stringify(collect()));
        flashStatus("Autosaved ✓");
      } catch (e) {
        flashStatus("Couldn't save (browser storage unavailable)");
      }
    }

    function load() {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return false;
        const saved = JSON.parse(raw);
        for (const f of fields) {
          if (saved[f] !== undefined && els[f]) els[f].value = saved[f];
        }
        if (onApply) onApply(saved);
        return true;
      } catch (e) {
        return false;
      }
    }

    // Wires every field to autosave on its own change, debounced so a
    // dragged slider doesn't spam writes. Returns nothing — fire and forget.
    function wire() {
      let debounceTimer = null;
      const trigger = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(saveNow, debounceMs);
      };
      for (const f of fields) {
        const el = els[f];
        if (!el) continue;
        el.addEventListener(el.tagName === "SELECT" ? "change" : "input", trigger);
      }
    }

    return { load, wire, saveNow, flashStatus };
  }

  // Makes the direct .tile children of `container` freely draggable (by
  // their .card-title, which doubles as a handle) and resizable (via an
  // injected corner grip), with each tile's position/size autosaved to
  // localStorage per page — same persistence story as createAutosave.
  //
  // Absolute positioning skips non-positioned ancestors, so tiles don't
  // need to be flattened out of whatever wrapper divs the page's normal
  // responsive layout already uses — only `container` needs to be their
  // shared coordinate space (it becomes position:relative here).
  //
  // Skipped below minViewport: free-dragging a canvas on a phone-width
  // screen is more hassle than help, so narrow screens keep the page's
  // normal responsive flow untouched.
  function createTileLayout({ key, container, minViewport = 860, minWidth = 220, minHeight = 140 }) {
    const noop = { reset() {} };
    if (!container || window.innerWidth < minViewport) return noop;
    // Absolute positioning skips non-positioned ancestors for layout
    // purposes, but DOM nesting still matters for finding them: tiles may
    // sit inside plain wrapper divs (a responsive .stack/.stage-row), not
    // just as direct children, so this has to search all descendants.
    const tiles = Array.from(container.querySelectorAll(".tile"));
    if (!tiles.length) return noop;

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) { saved = {}; }

    // Capture every tile's natural (in-flow) rect BEFORE any of them go
    // absolute — once the first tile leaves the flow, the rest would
    // reflow and their "natural" rects would no longer reflect the
    // page's actual default layout.
    const cRect = container.getBoundingClientRect();
    const naturals = new Map();
    for (const el of tiles) {
      const r = el.getBoundingClientRect();
      naturals.set(el, {
        left: Math.round(r.left - cRect.left),
        top: Math.round(r.top - cRect.top),
        width: Math.round(r.width),
        height: Math.round(r.height),
      });
    }

    // Tiles that share a data-tile-group occupy the same visual slot and
    // toggle visibility with each other (e.g. a diagram vs. a table view
    // of the same panel). Whichever is hidden at init measures as 0x0 —
    // borrow a visible groupmate's natural rect instead, so it lands in
    // the right place the moment it's shown, rather than collapsing to
    // the page's absolute-position default of (0, 0).
    const groups = new Map();
    for (const el of tiles) {
      const g = el.dataset.tileGroup;
      if (!g) continue;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(el);
    }
    for (const members of groups.values()) {
      const validRect = members.map((el) => naturals.get(el)).find((r) => r.width > 0 && r.height > 0);
      if (!validRect) continue;
      for (const el of members) {
        const r = naturals.get(el);
        if (r.width === 0 && r.height === 0) naturals.set(el, { ...validRect });
      }
    }

    container.style.position = "relative";
    let zCounter = 10;

    function fitContainerHeight() {
      let maxBottom = 0;
      for (const el of tiles) maxBottom = Math.max(maxBottom, el.offsetTop + el.offsetHeight);
      container.style.height = `${maxBottom + 4}px`;
    }

    function applyRect(el, rect) {
      el.style.position = "absolute";
      el.style.left = `${rect.left}px`;
      el.style.top = `${rect.top}px`;
      el.style.width = `${rect.width}px`;
      el.style.height = `${rect.height}px`;
    }

    function persist() {
      const out = {};
      for (const el of tiles) {
        out[el.dataset.tileId] = { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
      }
      try { localStorage.setItem(key, JSON.stringify(out)); } catch (e) { /* storage unavailable — layout just won't persist */ }
    }

    const INTERACTIVE = "button, a, input, select, textarea, .tile-resize-handle";

    for (const el of tiles) {
      applyRect(el, saved[el.dataset.tileId] || naturals.get(el));

      const handle = el.querySelector(":scope > .card-title") || el;
      handle.classList.add("tile-drag-handle");

      const grip = document.createElement("div");
      grip.className = "tile-resize-handle";
      grip.setAttribute("aria-hidden", "true");
      el.appendChild(grip);

      let drag = null;
      handle.addEventListener("pointerdown", (e) => {
        if (e.target.closest(INTERACTIVE)) return;
        drag = { startX: e.clientX, startY: e.clientY, left: el.offsetLeft, top: el.offsetTop };
        el.classList.add("dragging");
        el.style.zIndex = String(++zCounter);
        handle.setPointerCapture(e.pointerId);
      });
      handle.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const maxLeft = Math.max(0, container.clientWidth - 60);
        el.style.left = `${Math.max(0, Math.min(maxLeft, drag.left + (e.clientX - drag.startX)))}px`;
        el.style.top = `${Math.max(0, drag.top + (e.clientY - drag.startY))}px`;
        fitContainerHeight();
      });
      const endDrag = () => {
        if (!drag) return;
        drag = null;
        el.classList.remove("dragging");
        persist();
      };
      handle.addEventListener("pointerup", endDrag);
      handle.addEventListener("pointercancel", endDrag);

      let resize = null;
      grip.addEventListener("pointerdown", (e) => {
        resize = { startX: e.clientX, startY: e.clientY, width: el.offsetWidth, height: el.offsetHeight };
        el.classList.add("resizing");
        el.style.zIndex = String(++zCounter);
        grip.setPointerCapture(e.pointerId);
        e.stopPropagation();
      });
      grip.addEventListener("pointermove", (e) => {
        if (!resize) return;
        el.style.width = `${Math.max(minWidth, resize.width + (e.clientX - resize.startX))}px`;
        el.style.height = `${Math.max(minHeight, resize.height + (e.clientY - resize.startY))}px`;
        fitContainerHeight();
      });
      const endResize = () => {
        if (!resize) return;
        resize = null;
        el.classList.remove("resizing");
        persist();
      };
      grip.addEventListener("pointerup", endResize);
      grip.addEventListener("pointercancel", endResize);
    }

    fitContainerHeight();

    function reset() {
      try { localStorage.removeItem(key); } catch (e) { /* storage unavailable */ }
      for (const el of tiles) applyRect(el, naturals.get(el));
      fitContainerHeight();
    }

    return { reset };
  }

  window.TeachAI = window.TeachAI || {};
  window.TeachAI.base = { sleep, createRunToken, createAutosave, createTileLayout };
})();
