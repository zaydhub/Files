/* ============================================================
   Files — main app
   ============================================================ */
(function (global) {
  'use strict';

  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  const Cap = global.Capacitor;
  const isCapacitor = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());
  const plugins = (Cap && Cap.Plugins) || {};
  const capApp = plugins.App || null;
  const capStatusBar = plugins.StatusBar || null;

  /* ---------- Element cache ---------- */

  const el = {
    metaTheme:      $('#meta-theme-color'),
    views:          $$('.view'),
    tabbar:         $('#tabbar'),
    tabs:           $$('.tab'),

    homeDate:       $('#home-date'),
    greetingTitle:  $('#greeting-title'),
    storageCard:    $('#storage-card'),
    storageLabel:   $('#storage-label'),
    storageValue:   $('#storage-value'),
    storageFill:    $('#storage-fill'),
    storageSub:     $('#storage-sub'),
    quickGrid:      $('#quick-grid'),
    rootsCard:      $('#roots-card'),
    permNote:       $('#perm-note'),

    browseBack:     $('#browse-back'),
    browseTitle:    $('#browse-title'),
    browseRefresh:  $('#browse-refresh'),
    browseMenu:     $('#browse-menu'),
    pathBar:        $('#path-bar'),
    browseList:     $('#browse-list'),

    searchInput:    $('#search-input'),
    searchClear:    $('#search-clear'),
    searchScope:    $('#search-scope'),
    searchList:     $('#search-list'),
    searchHeader:   $('.view-header--search'),

    moreMain:            $('#more-main'),
    moreAppearance:      $('#more-appearance'),
    moreAccent:          $('#more-accent'),
    moreAbout:           $('#more-about'),
    moreAppearanceValue: $('#more-appearance-value'),
    moreAccentSwatch:    $('#more-accent-swatch'),
    moreAppearanceBack:  $('#more-appearance-back'),
    moreAccentBack:      $('#more-accent-back'),
    moreAboutBack:       $('#more-about-back'),
    moreSortValue:       $('#more-sort-value'),
    toggleHidden:        $('#toggle-hidden'),
    themeList:           $('#theme-list'),
    accentSwatches:      $('#accent-swatches'),
    moreFooter:          $('#more-footer')
  };

  /* ---------- State ---------- */

  const SORT_OPTIONS = [
    { key: 'name-asc',   label: 'Name (A–Z)' },
    { key: 'name-desc',  label: 'Name (Z–A)' },
    { key: 'newest',     label: 'Newest first' },
    { key: 'oldest',     label: 'Oldest first' },
    { key: 'largest',    label: 'Largest first' },
    { key: 'smallest',   label: 'Smallest first' }
  ];

  const state = {
    view: 'home',
    browseStack: [],          // array of paths, top = current
    currentItems: [],
    currentPath: '',
    sortMode: 'name-asc',
    showHidden: false,
    searchQuery: '',
    moreSub: 'main',
    quickTiles: [],           // cached quick access definitions
    initialized: false
  };

  /* ---------- Small helpers ---------- */

  function setThemeColor() {
    const resolved = Settings.resolvedTheme();
    const meta = el.metaTheme;
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#000000' : '#f5f5f7');
  }

  function updateGreeting() {
    const h = new Date().getHours();
    let g;
    if (h >= 5 && h < 12) g = 'Good morning';
    else if (h >= 12 && h < 17) g = 'Good afternoon';
    else if (h >= 17 && h < 22) g = 'Good evening';
    else g = 'Good night';
    el.greetingTitle.textContent = g;
    el.homeDate.textContent = U.longDate(Date.now());
  }

  /* ==========================================================
     SORT
     ========================================================== */

  function sortItems(items) {
    const mode = state.sortMode;
    const copy = items.slice();
    copy.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      switch (mode) {
        case 'name-desc':  return b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' });
        case 'newest':     return (b.modifiedAt || 0) - (a.modifiedAt || 0);
        case 'oldest':     return (a.modifiedAt || 0) - (b.modifiedAt || 0);
        case 'largest':    return (b.size || 0) - (a.size || 0);
        case 'smallest':   return (a.size || 0) - (b.size || 0);
        default:           return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      }
    });
    return copy;
  }

  function filterHidden(items) {
    if (state.showHidden) return items;
    return items.filter((i) => !i.isHidden);
  }

  /* ==========================================================
     RENDER: File item
     ========================================================== */

  function fileRowHtml(item) {
    const iconId = U.iconForItem(item);
    const modClass = U.iconClassForItem(item);
    const hiddenClass = item.isHidden ? ' is-hidden-item' : '';
    const subtitle = item.isDirectory
      ? 'Folder'
      : U.formatBytes(item.size) + (item.modifiedAt ? ' · ' + U.relativeTime(item.modifiedAt) : '');

    return (
      '<li class="file-item' + hiddenClass + '" data-path="' + U.escapeHtml(item.path) + '" data-dir="' + (item.isDirectory ? '1' : '0') + '">' +
        '<div class="file-face" role="button" tabindex="0" aria-label="' + U.escapeHtml(item.name) + '">' +
          '<span class="file-icon ' + modClass + '" aria-hidden="true">' +
            '<svg class="ico"><use href="#' + iconId + '"/></svg>' +
          '</span>' +
          '<span class="file-main">' +
            '<span class="file-name">' + U.escapeHtml(item.name) + '</span>' +
            '<span class="file-meta">' + U.escapeHtml(subtitle) + '</span>' +
          '</span>' +
        '</div>' +
      '</li>'
    );
  }

  function emptyStateHtml(iconId, title, sub) {
    return (
      '<div class="empty">' +
        '<div class="empty-ico"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' +
          '<use href="#' + iconId + '"/></svg></div>' +
        '<p class="empty-title">' + U.escapeHtml(title) + '</p>' +
        '<p class="empty-sub">' + U.escapeHtml(sub) + '</p>' +
      '</div>'
    );
  }

  /* ==========================================================
     HOME
     ========================================================== */

  const QUICK_DEFS = [
    { key: 'downloads', name: 'Downloads', icon: 'i-download' },
    { key: 'pictures',  name: 'Pictures',  icon: 'i-file-img' },
    { key: 'documents', name: 'Documents', icon: 'i-file-doc' },
    { key: 'dcim',      name: 'DCIM',      icon: 'i-camera' },
    { key: 'movies',    name: 'Movies',    icon: 'i-file-vid' },
    { key: 'music',     name: 'Music',     icon: 'i-file-aud' }
  ];

  async function renderHome() {
    updateGreeting();

    // Storage
    const info = await FS.getStorageInfo();
    if (info && info.total) {
      const used = info.used || 0;
      const total = info.total;
      const pct = Math.min(100, Math.round((used / total) * 100));
      el.storageLabel.textContent = 'Storage';
      el.storageValue.textContent = U.formatBytes(used) + ' of ' + U.formatBytes(total);
      el.storageFill.style.width = pct + '%';
      el.storageFill.style.background = pct > 90 ? 'var(--danger)' : 'var(--accent)';
      el.storageSub.textContent = U.formatBytes(info.free) + ' available · ' + pct + '% used';
    } else {
      el.storageLabel.textContent = 'Storage';
      el.storageValue.textContent = FS.available ? 'Unavailable' : 'Requires Android app';
      el.storageFill.style.width = '0%';
      el.storageSub.textContent = FS.available ? 'Cannot read storage info.' : 'Install the APK to browse files.';
    }

    // Standard paths
    const paths = await FS.getStandardPaths();

    // Quick access tiles
    let tilesHtml = '';
    for (const q of QUICK_DEFS) {
      const p = paths[q.key];
      const exists = p && await FS.isDirectory(p);
      const disabled = !exists;
      const count = disabled ? 0 : await FS.countChildren(p);
      tilesHtml += (
        '<button type="button" class="quick-tile" data-quick="' + q.key + '" ' +
                (disabled ? 'disabled style="opacity:.45;pointer-events:none"' : '') + '>' +
          '<span class="quick-tile-icon"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' +
            '<use href="#' + q.icon + '"/></svg></span>' +
          '<span class="quick-tile-name">' + U.escapeHtml(q.name) + '</span>' +
          '<span class="quick-tile-count">' + (disabled ? 'Not found' : (count + ' items')) + '</span>' +
        '</button>'
      );
    }
    el.quickGrid.innerHTML = tilesHtml;
    state.quickTiles = paths;

    // Roots
    const rootsRes = await FS.getStorageRoots();
    const roots = (rootsRes && rootsRes.roots) || [];
    if (roots.length) {
      let html = '';
      roots.forEach((r, i) => {
        if (i > 0) html += '<div class="row-sep"></div>';
        html += (
          '<button type="button" class="row-btn" data-root="' + U.escapeHtml(r.path) + '">' +
            '<span class="row-ico"><svg class="ico ico-20" aria-hidden="true"><use href="#i-folder"/></svg></span>' +
            '<span class="row-label">' + U.escapeHtml(r.name) + '</span>' +
            '<svg class="ico ico-18 row-chev" aria-hidden="true"><use href="#i-chevron"/></svg>' +
          '</button>'
        );
      });
      el.rootsCard.innerHTML = html;
    } else {
      el.rootsCard.innerHTML = (
        '<div class="row-btn row-btn--static">' +
          '<span class="row-ico"><svg class="ico ico-20" aria-hidden="true"><use href="#i-warn"/></svg></span>' +
          '<span class="row-label">' + (FS.available ? 'No storage roots found' : 'Android app required') + '</span>' +
        '</div>'
      );
    }

    // Permission banner
    if (!FS.available) {
      el.permNote.textContent = 'Open this app as the installed APK to access your device storage.';
    } else {
      const perm = await FS.checkPermission();
      if (!perm.granted) {
        el.permNote.innerHTML =
          'Storage permission is required. ' +
          '<button type="button" id="perm-grant" style="color:var(--accent);font-weight:600;text-decoration:underline;background:none;border:0;padding:0;font:inherit;cursor:pointer">Grant access</button>';
        const btn = $('#perm-grant');
        if (btn) btn.addEventListener('click', async () => {
          await FS.requestPermission();
          setTimeout(async () => {
            const ok = await FS.checkPermission();
            if (ok.granted) renderHome();
          }, 800);
        });
      } else {
        el.permNote.textContent = '';
      }
    }
  }

  /* ==========================================================
     BROWSE
     ========================================================== */

  function renderBreadcrumbs() {
    const stack = state.browseStack;
    if (!stack.length) {
      el.pathBar.innerHTML = '';
      return;
    }

    // Build an array of {label, path}
    const crumbs = stack.map((p, i) => ({
      label: i === 0 ? U.basename(p) || p : U.basename(p),
      path: p
    }));

    let html = '';
    crumbs.forEach((c, i) => {
      if (i > 0) html += '<span class="path-sep" aria-hidden="true">›</span>';
      const last = i === crumbs.length - 1;
      html += (
        '<button type="button" class="path-crumb' + (last ? ' is-last' : '') + '" ' +
                'data-index="' + i + '">' + U.escapeHtml(c.label) + '</button>'
      );
    });
    el.pathBar.innerHTML = html;
    // scroll to end
    requestAnimationFrame(() => { el.pathBar.scrollLeft = el.pathBar.scrollWidth; });
  }

  function updateBrowseHeader() {
    const stack = state.browseStack;
    el.browseBack.hidden = stack.length <= 1;
    el.browseTitle.textContent = stack.length ? (U.basename(stack[stack.length - 1]) || stack[stack.length - 1]) : 'Browse';
  }

  async function loadDirectory(path, options) {
    const opts = options || {};
    if (opts.push !== false) {
      const top = state.browseStack[state.browseStack.length - 1];
      if (top !== path) state.browseStack.push(path);
    }
    state.currentPath = path;

    updateBrowseHeader();
    renderBreadcrumbs();

    el.browseList.innerHTML = '<div class="empty"><div class="empty-ico"><svg class="ico"><use href="#i-folder"/></svg></div><p class="empty-title">Loading…</p></div>';

    try {
      const res = await FS.list(path);
      const items = filterHidden(res.items || []);
      const sorted = sortItems(items);
      state.currentItems = sorted;

      if (!sorted.length) {
        el.browseList.innerHTML = emptyStateHtml('i-folder', 'Empty folder', 'Nothing here.');
      } else {
        let html = '<ul class="file-list">';
        for (const it of sorted) html += fileRowHtml(it);
        html += '</ul>';
        el.browseList.innerHTML = html;
      }
    } catch (e) {
      el.browseList.innerHTML = emptyStateHtml('i-warn', 'Cannot open folder', String(e.message || 'Permission denied'));
    }

    const v = $('#view-browse');
    if (v) v.scrollTop = 0;
  }

  async function refreshBrowse() {
    if (!state.currentPath) return;
    await loadDirectory(state.currentPath, { push: false });
  }

  function goBackBrowse() {
    if (state.browseStack.length <= 1) return;
    state.browseStack.pop();
    const parent = state.browseStack[state.browseStack.length - 1];
    loadDirectory(parent, { push: false });
  }

  /* ==========================================================
     FILE ACTIONS
     ========================================================== */

  function findItemByPath(path) {
    return state.currentItems.find((i) => i.path === path);
  }

  async function openItem(item) {
    if (item.isDirectory) {
      await loadDirectory(item.path);
    } else {
      try {
        await FS.openFile(item.path, item.mime);
      } catch (e) {
        UI.toast('No app can open this file');
      }
    }
  }

  async function showItemActions(item) {
    const actions = [];
    if (item.isDirectory) actions.push({ key: 'open', label: 'Open', icon: 'i-folder' });
    else actions.push({ key: 'open', label: 'Open with…', icon: 'i-share' });
    if (!item.isDirectory) actions.push({ key: 'share', label: 'Share', icon: 'i-share' });
    actions.push({ key: 'rename', label: 'Rename', icon: 'i-edit' });
    actions.push({ key: 'info', label: 'Info', icon: 'i-info' });
    actions.push({ key: 'delete', label: 'Delete', icon: 'i-trash', danger: true });

    const choice = await UI.openSheet(item.name, actions);
    if (!choice) return;

    if (choice === 'open') return openItem(item);
    if (choice === 'share') {
      try { await FS.shareFile(item.path, item.mime); }
      catch (e) { UI.toast('Cannot share this file'); }
      return;
    }
    if (choice === 'rename') {
      UI.openInput({
        title: 'Rename',
        value: item.name,
        saveLabel: 'Rename',
        onSave: async (val) => {
          try {
            await FS.rename(item.path, val);
            UI.toast('Renamed');
            refreshBrowse();
          } catch (e) { UI.toast('Rename failed'); }
        }
      });
      return;
    }
    if (choice === 'info') {
      const sub = item.isDirectory
        ? 'Folder'
        : U.formatBytes(item.size) + (item.mime ? ' · ' + item.mime : '');
      UI.confirm({
        title: 'Info',
        message: item.name + '\n' + sub + '\n' + (item.path || ''),
        confirmLabel: 'OK',
        destructive: false,
        onConfirm: () => {}
      });
      return;
    }
    if (choice === 'delete') {
      UI.confirm({
        title: 'Delete "' + item.name + '"?',
        message: item.isDirectory ? 'This folder and its contents will be permanently deleted.' : 'This file will be permanently deleted.',
        confirmLabel: 'Delete',
        destructive: true,
        onConfirm: async () => {
          try {
            await FS.delete([item.path]);
            UI.toast('Deleted');
            refreshBrowse();
          } catch (e) { UI.toast('Delete failed'); }
        }
      });
    }
  }

  function showFolderMenu() {
    UI.openSheet('Folder options', [
      { key: 'new-folder', label: 'New folder', icon: 'i-folder-plus' }
    ]).then((choice) => {
      if (choice === 'new-folder') {
        UI.openInput({
          title: 'New folder',
          placeholder: 'Folder name',
          saveLabel: 'Create',
          onSave: async (val) => {
            try {
              await FS.createDirectory(U.joinPath(state.currentPath, val));
              UI.toast('Folder created');
              refreshBrowse();
            } catch (e) { UI.toast('Could not create folder'); }
          }
        });
      }
    });
  }

  /* ==========================================================
     SEARCH (filters current folder, shallow)
     ========================================================== */

  function renderSearch() {
    const q = state.searchQuery.trim().toLowerCase();
    el.searchClear.hidden = !q;
    el.searchScope.textContent = state.currentPath ? ('In ' + state.currentPath) : 'Open a folder to search inside it.';

    if (!q) {
      el.searchList.innerHTML = emptyStateHtml('i-search', 'Search files', 'Type to filter files in the current folder.');
      return;
    }

    const matches = state.currentItems.filter((i) => i.name.toLowerCase().includes(q));
    if (!matches.length) {
      el.searchList.innerHTML = emptyStateHtml('i-search', 'No matches', 'No files match "' + q + '".');
      return;
    }
    let html = '<ul class="file-list">';
    for (const it of matches) html += fileRowHtml(it);
    html += '</ul>';
    el.searchList.innerHTML = html;
  }

  /* ==========================================================
     MORE
     ========================================================== */

  function showMoreSub(name) {
    if (state.moreSub === name) return;
    state.moreSub = name;
    el.moreMain.hidden       = name !== 'main';
    el.moreAppearance.hidden = name !== 'appearance';
    el.moreAccent.hidden     = name !== 'accent';
    el.moreAbout.hidden      = name !== 'about';

    if (name === 'main') updateMoreValues();
    if (name === 'accent') renderAccentSwatches();
    if (name === 'appearance') syncThemeUI();
  }

  function isMoreSubOpen() { return state.moreSub !== 'main'; }

  function closeMoreSub() {
    if (state.moreSub === 'main') return;
    state.moreSub = 'main';
    el.moreMain.hidden = false;
    el.moreAppearance.hidden = true;
    el.moreAccent.hidden = true;
    el.moreAbout.hidden = true;
    updateMoreValues();
  }

  function updateMoreValues() {
    el.moreAppearanceValue.textContent =
      ({ light: 'Light', dark: 'Dark', system: 'System' }[Settings.getTheme()]) || 'System';

    const resolved = Settings.resolvedTheme();
    const accent = Settings.PALETTE.find((p) => p.id === Settings.getAccent()) || Settings.PALETTE[0];
    const mode = resolved === 'dark' ? accent.dark : accent.light;
    el.moreAccentSwatch.style.background = mode.bg;

    const sortLabel = (SORT_OPTIONS.find((o) => o.key === state.sortMode) || SORT_OPTIONS[0]).label;
    el.moreSortValue.textContent = sortLabel;

    el.toggleHidden.checked = state.showHidden;
  }

  function syncThemeUI() {
    const current = Settings.getTheme();
    $$('.theme-row', el.themeList).forEach((row) => {
      row.setAttribute('aria-checked', row.dataset.themeOpt === current ? 'true' : 'false');
    });
    updateMoreValues();
  }

  function renderAccentSwatches() {
    const current = Settings.getAccent();
    const resolved = Settings.resolvedTheme();
    let html = '';
    for (const p of Settings.PALETTE) {
      const mode = resolved === 'dark' ? p.dark : p.light;
      const checked = p.id === current;
      html += (
        '<button type="button" class="swatch" role="radio" data-accent="' + p.id + '" ' +
                'aria-checked="' + (checked ? 'true' : 'false') + '" ' +
                'aria-label="' + U.escapeHtml(p.name) + '" ' +
                'style="--swatch-color:' + mode.bg + ';--swatch-ink:' + mode.ink + '">' +
          '<span class="swatch-check" aria-hidden="true">' +
            '<svg class="ico" viewBox="0 0 24 24"><use href="#i-check"/></svg>' +
          '</span>' +
        '</button>'
      );
    }
    el.accentSwatches.innerHTML = html;
  }

  function syncStatusBar() {
    if (!capStatusBar) return;
    const resolved = Settings.resolvedTheme();
    try {
      if (resolved === 'dark') {
        capStatusBar.setStyle({ style: 'DARK' });
        capStatusBar.setBackgroundColor({ color: '#000000' });
      } else {
        capStatusBar.setStyle({ style: 'LIGHT' });
        capStatusBar.setBackgroundColor({ color: '#f5f5f7' });
      }
    } catch (e) {}
  }

  /* ==========================================================
     NAVIGATION
     ========================================================== */

  function switchView(name) {
    if (state.view === name) return;
    state.view = name;

    for (const v of el.views) v.classList.toggle('is-active', v.dataset.view === name);
    for (const tab of el.tabs) {
      const active = tab.dataset.tab === name;
      tab.classList.toggle('is-active', active);
      if (active) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }

    if (name !== 'search' && document.activeElement === el.searchInput) el.searchInput.blur();

    if (name === 'more') { closeMoreSub(); updateMoreValues(); }
    if (name === 'home') renderHome();
    if (name === 'browse' && !state.browseStack.length) {
      // First time: open root
      if (FS.available) openRootFromHome();
    }
    if (name === 'search') renderSearch();
  }

  async function openRootFromHome() {
    const rootsRes = await FS.getStorageRoots();
    const roots = (rootsRes && rootsRes.roots) || [];
    const rootPath = roots.length ? roots[0].path : '/';
    state.browseStack = [rootPath];
    await loadDirectory(rootPath, { push: false });
  }

  async function openPathFromHome(path) {
    state.browseStack = [path];
    await loadDirectory(path, { push: false });
    switchView('browse');
  }

  /* ==========================================================
     EVENT WIRING
     ========================================================== */

  function wireEvents() {
    /* Tabs */
    el.tabbar.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (!tab) return;
      const name = tab.dataset.tab;
      if (!name || name === state.view) return;
      switchView(name);
    });

    /* Home */
    el.quickGrid.addEventListener('click', (e) => {
      const tile = e.target.closest('.quick-tile');
      if (!tile) return;
      const key = tile.dataset.quick;
      const p = state.quickTiles[key];
      if (p) openPathFromHome(p);
    });
    el.rootsCard.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-root]');
      if (!btn) return;
      openPathFromHome(btn.dataset.root);
    });

    /* Browse */
    el.browseBack.addEventListener('click', goBackBrowse);
    el.browseRefresh.addEventListener('click', refreshBrowse);
    el.browseMenu.addEventListener('click', showFolderMenu);

    el.pathBar.addEventListener('click', (e) => {
      const crumb = e.target.closest('.path-crumb');
      if (!crumb) return;
      const idx = Number(crumb.dataset.index);
      if (!Number.isFinite(idx)) return;
      if (idx === state.browseStack.length - 1) return;
      state.browseStack = state.browseStack.slice(0, idx + 1);
      loadDirectory(state.browseStack[idx], { push: false });
    });

    /* File list — click + long press */
    let pressTimer = null;
    let pressTarget = null;
    let suppressClick = false;

    function onFilePointerDown(e) {
      const face = e.target.closest && e.target.closest('.file-face');
      if (!face) return;
      const item = face.closest('.file-item');
      if (!item) return;
      pressTarget = {
        path: item.dataset.path,
        startX: e.clientX,
        startY: e.clientY,
        moved: false
      };
      suppressClick = false;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        if (pressTarget && !pressTarget.moved) {
          suppressClick = true;
          const it = findItemByPath(pressTarget.path);
          if (it) showItemActions(it);
        }
      }, 480);
    }

    function onFilePointerMove(e) {
      if (!pressTarget || pressTarget.moved) return;
      const dx = Math.abs(e.clientX - pressTarget.startX);
      const dy = Math.abs(e.clientY - pressTarget.startY);
      if (dx > 8 || dy > 8) {
        pressTarget.moved = true;
        clearTimeout(pressTimer);
      }
    }

    function onFilePointerEnd() {
      clearTimeout(pressTimer);
      pressTarget = null;
    }

    function onFileListClick(e) {
      const face = e.target.closest && e.target.closest('.file-face');
      if (!face) return;
      if (suppressClick) { suppressClick = false; return; }
      const item = face.closest('.file-item');
      if (!item) return;
      const it = findItemByPath(item.dataset.path);
      if (it) openItem(it);
    }

    for (const listEl of [el.browseList, el.searchList]) {
      listEl.addEventListener('click', onFileListClick);
      listEl.addEventListener('pointerdown', onFilePointerDown, { passive: true });
      listEl.addEventListener('pointermove', onFilePointerMove, { passive: true });
      listEl.addEventListener('pointerup', onFilePointerEnd);
      listEl.addEventListener('pointercancel', onFilePointerEnd);
      listEl.addEventListener('contextmenu', (ev) => {
        if (ev.target.closest && ev.target.closest('.file-face')) ev.preventDefault();
      });
    }

    /* Search */
    el.searchInput.addEventListener('input', () => {
      state.searchQuery = el.searchInput.value;
      renderSearch();
    });
    el.searchClear.addEventListener('click', () => {
      el.searchInput.value = '';
      state.searchQuery = '';
      renderSearch();
      el.searchInput.focus({ preventScroll: true });
    });

    /* More */
    const moreView = $('#view-more');
    moreView.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-more-nav]');
      if (nav) { showMoreSub(nav.dataset.moreNav); return; }
    });
    el.moreAppearanceBack.addEventListener('click', closeMoreSub);
    el.moreAccentBack.addEventListener('click', closeMoreSub);
    el.moreAboutBack.addEventListener('click', closeMoreSub);

    el.themeList.addEventListener('click', (e) => {
      const row = e.target.closest('.theme-row');
      if (!row) return;
      Settings.setTheme(row.dataset.themeOpt);
      syncThemeUI();
      renderAccentSwatches();
    });

    el.accentSwatches.addEventListener('click', (e) => {
      const sw = e.target.closest('.swatch');
      if (!sw) return;
      Settings.setAccent(sw.dataset.accent);
      renderAccentSwatches();
      updateMoreValues();
    });

    el.moreSortValue.parentElement.addEventListener('click', async () => {
      const choice = await UI.openSortSheet('Sort by', SORT_OPTIONS, state.sortMode);
      if (choice) {
        state.sortMode = choice;
        Settings.setSort(choice);
        updateMoreValues();
        if (state.currentItems.length) refreshBrowse();
      }
    });

    el.toggleHidden.addEventListener('change', () => {
      state.showHidden = el.toggleHidden.checked;
      Settings.setShowHidden(state.showHidden);
      if (state.currentPath) refreshBrowse();
    });

    /* Back button */
    if (capApp && typeof capApp.addListener === 'function') {
      try {
        capApp.addListener('backButton', () => {
          if (!el.sheetBackdrop.hidden) { UI.closeSheet(); return; }
          if (!el.sortBackdrop.hidden) { el.sortBackdrop.hidden = true; return; }
          if (!el.inputBackdrop.hidden) { UI.closeInput(); return; }
          if (!el.dialogBackdrop.hidden) { UI.closeDialog(); return; }
          if (isMoreSubOpen()) { closeMoreSub(); return; }
          if (state.view === 'browse' && state.browseStack.length > 1) { goBackBrowse(); return; }
          if (state.view !== 'home') { switchView('home'); return; }
          capApp.exitApp();
        });
      } catch (e) {}
    }

    Settings.onThemeChange(() => {
      renderAccentSwatches();
      updateMoreValues();
      syncStatusBar();
      setThemeColor();
    });
  }

  /* ==========================================================
     BOOT
     ========================================================== */

  async function boot() {
    Settings.applyTheme();
    setThemeColor();
    syncStatusBar();
    syncThemeUI();
    renderAccentSwatches();

    // Restore sort + hidden from settings
    state.sortMode = Settings.getSort();
    state.showHidden = Settings.getShowHidden();

    updateMoreValues();
    wireEvents();

    if (FS.available) {
      const perm = await FS.checkPermission();
      if (!perm.granted) await FS.requestPermission();
    }

    renderHome();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && state.view === 'home') {
        renderHome();
      }
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
