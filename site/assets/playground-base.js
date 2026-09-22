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

  window.TeachAI = window.TeachAI || {};
  window.TeachAI.base = { sleep, createRunToken, createAutosave };
})();
