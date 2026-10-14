/* ============================================================
   Files — shared UI primitives (sheets, dialog, toast)
   ============================================================ */
(function (global) {
  'use strict';

  const $ = (s) => document.querySelector(s);

  const el = {
    sheetBackdrop: $('#sheet-backdrop'),
    sheetTitle:    $('#sheet-title'),
    sheetActions:  $('#sheet-actions'),
    sheetCancel:   $('#sheet-cancel'),

    sortBackdrop:  $('#sort-sheet-backdrop'),
    sortTitle:     $('.sheet-title', $('#sort-sheet-backdrop')),
    sortActions:   $('#sort-sheet-actions'),
    sortCancel:    $('#sort-sheet-cancel'),

    inputBackdrop: $('#input-sheet-backdrop'),
    inputTitle:    $('#input-sheet-title'),
    inputField:    $('#input-sheet-field'),
    inputCancel:   $('#input-sheet-cancel'),
    inputSave:     $('#input-sheet-save'),

    dialogBackdrop: $('#dialog-backdrop'),
    dialogTitle:    $('#dialog-title'),
    dialogMsg:      $('#dialog-msg'),
    dialogCancel:   $('#dialog-cancel'),
    dialogConfirm:  $('#dialog-confirm'),

    toast:     $('#toast'),
    toastMsg:  $('#toast-msg')
  };

  const state = {
    sheetOnAction: null,
    inputOnSave: null,
    inputValidator: null,
    dialogOnConfirm: null,
    toastTimer: null
  };

  /* ---------- Bottom sheet ---------- */

  function openSheet(title, actions) {
    el.sheetTitle.textContent = title || '';
    let html = '';
    for (const a of actions) {
      const cls = 'sheet-btn' + (a.danger ? ' sheet-btn--danger' : '');
      html += (
        '<button type="button" class="' + cls + '" data-action="' + a.key + '">' +
          '<svg class="ico ico-20" viewBox="0 0 24 24" aria-hidden="true">' +
            '<use href="#' + a.icon + '"/></svg>' +
          '<span>' + a.label + '</span>' +
        '</button>'
      );
    }
    el.sheetActions.innerHTML = html;
    el.sheetBackdrop.hidden = false;
    state.sheetOnAction = null;

    const handler = (e) => {
      const btn = e.target.closest('.sheet-btn');
      if (!btn) return;
      const key = btn.dataset.action;
      const cb = state.sheetOnAction;
      closeSheet();
      if (typeof cb === 'function') cb(key);
    };

    // one-shot listener
    el.sheetActions.addEventListener('click', handler, { once: false });
    // replace previous by tagging
    if (state.sheetOnActionCleanup) state.sheetOnActionCleanup();
    const cleanup = () => el.sheetActions.removeEventListener('click', handler);
    state.sheetOnActionCleanup = cleanup;

    return new Promise((resolve) => { state.sheetOnAction = resolve; });
  }

  function closeSheet() {
    el.sheetBackdrop.hidden = true;
  }

  el.sheetCancel.addEventListener('click', closeSheet);
  el.sheetBackdrop.addEventListener('click', (e) => {
    if (e.target === el.sheetBackdrop) closeSheet();
  });

  /* ---------- Sort sheet (same as bottom sheet but separate element) ---------- */

  function openSortSheet(title, options, currentKey) {
    el.sortTitle.textContent = title || 'Sort by';
    let html = '';
    for (const o of options) {
      const checked = o.key === currentKey;
      html += (
        '<button type="button" class="sheet-btn" data-key="' + o.key + '" ' +
                'aria-checked="' + (checked ? 'true' : 'false') + '">' +
          '<span style="flex:1">' + o.label + '</span>' +
          (checked
            ? '<svg class="ico ico-18" viewBox="0 0 24 24" style="color:var(--accent)">' +
              '<use href="#i-check"/></svg>'
            : '') +
        '</button>'
      );
    }
    el.sortActions.innerHTML = html;
    el.sortBackdrop.hidden = false;

    return new Promise((resolve) => {
      const handler = (e) => {
        const btn = e.target.closest('[data-key]');
        if (!btn) return;
        el.sortActions.removeEventListener('click', handler);
        el.sortBackdrop.hidden = true;
        resolve(btn.dataset.key);
      };
      el.sortActions.addEventListener('click', handler);
    });
  }

  el.sortCancel.addEventListener('click', () => { el.sortBackdrop.hidden = true; });
  el.sortBackdrop.addEventListener('click', (e) => {
    if (e.target === el.sortBackdrop) el.sortBackdrop.hidden = true;
  });

  /* ---------- Input sheet (rename / new folder) ---------- */

  function openInput(opts) {
    el.inputTitle.textContent = opts.title || '';
    el.inputField.value = opts.value || '';
    el.inputField.placeholder = opts.placeholder || '';
    el.inputSave.textContent = opts.saveLabel || 'Save';
    el.inputSave.disabled = !opts.value;

    el.inputBackdrop.hidden = false;
    requestAnimationFrame(() => {
      el.inputField.focus({ preventScroll: true });
      try {
        const len = el.inputField.value.length;
        el.inputField.setSelectionRange(len, len);
      } catch (e) {}
    });

    state.inputOnSave = opts.onSave || null;
    state.inputValidator = opts.validate || null;
  }

  function closeInput() {
    el.inputBackdrop.hidden = true;
    state.inputOnSave = null;
    state.inputValidator = null;
  }

  el.inputCancel.addEventListener('click', closeInput);
  el.inputBackdrop.addEventListener('click', (e) => {
    if (e.target === el.inputBackdrop) closeInput();
  });
  el.inputField.addEventListener('input', () => {
    const val = el.inputField.value.trim();
    el.inputSave.disabled = !val;
  });
  el.inputField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!el.inputSave.disabled) el.inputSave.click();
    }
  });
  el.inputSave.addEventListener('click', () => {
    const val = el.inputField.value.trim();
    if (!val) return;
    const cb = state.inputOnSave;
    closeInput();
    if (typeof cb === 'function') cb(val);
  });

  /* ---------- Confirm dialog ---------- */

  function confirm(opts) {
    el.dialogTitle.textContent = opts.title || 'Are you sure?';
    const msg = opts.message || '';
    el.dialogMsg.textContent = msg;
    el.dialogMsg.hidden = !msg;
    el.dialogConfirm.textContent = opts.confirmLabel || 'Confirm';
    el.dialogConfirm.classList.toggle('dialog-btn--danger', opts.destructive !== false);
    el.dialogBackdrop.hidden = false;
    el.dialogConfirm.focus({ preventScroll: true });
    state.dialogOnConfirm = opts.onConfirm || null;
    return new Promise((resolve) => {
      state.dialogResolve = resolve;
    });
  }

  function closeDialog() {
    el.dialogBackdrop.hidden = true;
    if (state.dialogResolve) state.dialogResolve(false);
    state.dialogResolve = null;
    state.dialogOnConfirm = null;
  }

  el.dialogCancel.addEventListener('click', closeDialog);
  el.dialogBackdrop.addEventListener('click', (e) => {
    if (e.target === el.dialogBackdrop) closeDialog();
  });
  el.dialogConfirm.addEventListener('click', async () => {
    const cb = state.dialogOnConfirm;
    const resolve = state.dialogResolve;
    el.dialogBackdrop.hidden = true;
    state.dialogOnConfirm = null;
    state.dialogResolve = null;
    if (resolve) resolve(true);
    if (typeof cb === 'function') await cb();
  });

  /* ---------- Toast ---------- */

  function toast(msg) {
    clearTimeout(state.toastTimer);
    el.toastMsg.textContent = msg;
    el.toast.hidden = false;
    state.toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2200);
  }

  /* ---------- Sheet swipe-to-dismiss ---------- */
  function wireSheetDrag(backdropEl, onDismiss) {
    if (!backdropEl) return;
    const sheetEl = backdropEl.querySelector('.sheet');
    const handleEl = sheetEl ? sheetEl.querySelector('.sheet-handle') : null;
    if (!sheetEl || !handleEl) return;

    const isTop = backdropEl.classList.contains('sheet-backdrop--top');
    let drag = null;

    handleEl.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag = { startY: e.clientY, id: e.pointerId, height: sheetEl.offsetHeight };
      try { handleEl.setPointerCapture(e.pointerId); } catch (err) {}
      sheetEl.style.transition = 'none';
      e.preventDefault();
    });

    handleEl.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      let dy = e.clientY - drag.startY;
      if (isTop && dy > 0) dy *= .28;
      if (!isTop && dy < 0) dy *= .28;
      sheetEl.style.transform = 'translateY(' + dy + 'px)';
      e.preventDefault();
    });

    handleEl.addEventListener('pointerup', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dy = e.clientY - drag.startY;
      const d = drag; drag = null;
      const threshold = Math.min(120, d.height * .34);
      const dismiss = isTop ? Math.abs(dy) > threshold : dy > threshold;
      if (dismiss) {
        const dir = isTop ? (dy < 0 ? -1 : 1) : 1;
        sheetEl.style.transition = 'transform .22s var(--ease), opacity .22s ease';
        sheetEl.style.transform = 'translateY(' + (dir * (d.height + 80)) + 'px)';
        sheetEl.style.opacity = '0';
        setTimeout(() => {
          sheetEl.style.transition = '';
          sheetEl.style.transform = '';
          sheetEl.style.opacity = '';
          if (typeof onDismiss === 'function') onDismiss();
        }, 200);
      } else {
        sheetEl.style.transition = 'transform .24s var(--ease)';
        sheetEl.style.transform = '';
        setTimeout(() => { sheetEl.style.transition = ''; }, 260);
      }
    });

    handleEl.addEventListener('pointercancel', () => {
      drag = null;
      sheetEl.style.transition = '';
      sheetEl.style.transform = '';
    });
  }

  wireSheetDrag(el.sheetBackdrop, closeSheet);
  wireSheetDrag(el.sortBackdrop, () => { el.sortBackdrop.hidden = true; });
  wireSheetDrag(el.inputBackdrop, closeInput);

  global.UI = {
    openSheet,
    closeSheet,
    openSortSheet,
    openInput,
    closeInput,
    confirm,
    closeDialog,
    toast
  };
})(window);
