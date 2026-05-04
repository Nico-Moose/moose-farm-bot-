/* Moose Farm performance boost: safe client-side request coalescing/debounce.
   Не меняет игровую логику: только убирает повторные одновременные refresh-запросы. */
(function(){
  const inflight = Object.create(null);
  const lastRun = Object.create(null);

  function wrapAsyncCoalesced(name, minGapMs) {
    const original = window[name];
    if (typeof original !== 'function' || original.__moosePerfWrapped) return;

    const wrapped = async function(...args) {
      const force = !!args[0];
      const key = name + ':' + JSON.stringify(args || []);
      const now = Date.now();

      if (inflight[key]) return inflight[key];

      if (!force && minGapMs > 0 && lastRun[key] && (now - lastRun[key]) < minGapMs) {
        return Promise.resolve();
      }

      lastRun[key] = now;
      inflight[key] = Promise.resolve()
        .then(() => original.apply(this, args))
        .finally(() => { delete inflight[key]; });

      return inflight[key];
    };

    wrapped.__moosePerfWrapped = true;
    window[name] = wrapped;
  }

  function wrapInputDebounce(inputId, delayMs) {
    const input = document.getElementById(inputId);
    if (!input || input.dataset.moosePerfDebounce === '1') return;
    input.dataset.moosePerfDebounce = '1';

    let timer = null;
    input.addEventListener('input', function(event) {
      if (!event || event.__mooseDebounced) return;
      event.stopImmediatePropagation();
      clearTimeout(timer);
      timer = setTimeout(() => {
        const next = new Event('input', { bubbles: true, cancelable: true });
        next.__mooseDebounced = true;
        input.dispatchEvent(next);
      }, delayMs);
    }, true);
  }

  function applyPerformanceWraps() {
    wrapAsyncCoalesced('loadMe', 250);
    wrapAsyncCoalesced('loadHistory', 350);
    wrapAsyncCoalesced('loadTops', 1200);
    wrapAsyncCoalesced('loadAdminEvents', 350);
    wrapInputDebounce('admin-login', 180);
    wrapInputDebounce('admin-events-login', 180);
  }

  applyPerformanceWraps();
  setTimeout(applyPerformanceWraps, 0);
  document.addEventListener('DOMContentLoaded', applyPerformanceWraps);
})();
