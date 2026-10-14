/* ============================================================
   Files — filesystem adapter
   Wraps the native FilesystemExt plugin. Provides a uniform
   async API. Falls back to "unavailable" on non-native.
   ============================================================ */
(function (global) {
  'use strict';

  const Cap = global.Capacitor;
  const isNative = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());
  const plugins = (Cap && Cap.Plugins) || {};
  const native = plugins.FilesystemExt || null;

  const FS = {
    available: isNative && !!native,

    async checkPermission() {
      if (!FS.available) return { granted: false };
      try { return await native.checkStoragePermission(); }
      catch (e) { return { granted: false }; }
    },

    async requestPermission() {
      if (!FS.available) return;
      try { await native.requestStoragePermission(); }
      catch (e) { /* ignore */ }
    },

    async getStorageRoots() {
      if (!FS.available) return { roots: [] };
      try { return await native.getStorageRoots(); }
      catch (e) { return { roots: [] }; }
    },

    async getStandardPaths() {
      if (!FS.available) return {};
      try { return await native.getStandardPaths(); }
      catch (e) { return {}; }
    },

    async getStorageInfo() {
      if (!FS.available) return null;
      try { return await native.getStorageInfo(); }
      catch (e) { return null; }
    },

    async list(path) {
      if (!FS.available) return { items: [], path: path };
      const res = await native.listDirectory({ path: path });
      return res || { items: [], path: path };
    },

    async createDirectory(path) {
      if (!FS.available) throw new Error('Unavailable');
      return native.createDirectory({ path: path });
    },

    async delete(paths) {
      if (!FS.available) throw new Error('Unavailable');
      return native.deleteItems({ paths: paths });
    },

    async rename(path, newName) {
      if (!FS.available) throw new Error('Unavailable');
      return native.renameItem({ path: path, newName: newName });
    },

    async copy(sources, destination) {
      if (!FS.available) throw new Error('Unavailable');
      return native.copyItems({ sources: sources, destination: destination });
    },

    async move(sources, destination) {
      if (!FS.available) throw new Error('Unavailable');
      return native.moveItems({ sources: sources, destination: destination });
    },

    async openFile(path, mime) {
      if (!FS.available) throw new Error('Unavailable');
      return native.openFile({ path: path, mime: mime || '' });
    },

    async shareFile(path, mime) {
      if (!FS.available) throw new Error('Unavailable');
      return native.shareFile({ path: path, mime: mime || '' });
    },

    /**
     * Count direct children of a folder (best-effort, silent on error).
     * Used on the Home quick-access tiles.
     */
    async countChildren(path) {
      if (!FS.available) return 0;
      try {
        const res = await native.listDirectory({ path: path });
        return res && Array.isArray(res.items) ? res.items.length : 0;
      } catch (e) {
        return 0;
      }
    },

    /** Does the path exist as a directory? */
    async isDirectory(path) {
      if (!FS.available) return false;
      try {
        const res = await native.listDirectory({ path: path });
        return !!res;
      } catch (e) {
        return false;
      }
    },

    isNative
  };

  global.FS = FS;
})(window);
