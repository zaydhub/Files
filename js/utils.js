/* ============================================================
   Files — utilities
   ============================================================ */
(function (global) {
  'use strict';

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatBytes(bytes, decimals) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const k = 1024;
    const dm = decimals == null ? 1 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    let h = d.getHours();
    const m = d.getMinutes();
    const suffix = h >= 12 ? 'pm' : 'am';
    h = h % 12; if (h === 0) h = 12;
    return pad2(h) + ':' + pad2(m) + ' ' + suffix;
  }

  function startOfDay(ts) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function relativeTime(ts) {
    if (!ts) return '';
    const now = Date.now();
    const diff = now - ts;
    if (diff < 45000) return 'Just now';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + (mins === 1 ? ' min ago' : ' mins ago');
    const hours = Math.floor(diff / 3600000);
    if (hours < 24 && startOfDay(now) === startOfDay(ts)) {
      return hours + (hours === 1 ? ' hour ago' : ' hours ago');
    }
    const dayDiff = Math.round((startOfDay(now) - startOfDay(ts)) / 86400000);
    if (dayDiff === 1) return 'Yesterday';
    if (dayDiff < 7) return new Date(ts).toLocaleDateString(undefined, { weekday: 'long' });
    if (new Date(ts).getFullYear() === new Date().getFullYear()) {
      return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function longDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric'
    });
  }

  /** Icon symbol id based on file extension + isDirectory. */
  function iconForItem(item) {
    if (!item) return 'i-file';
    if (item.isDirectory) return 'i-folder';
    const ext = (item.extension || '').toLowerCase();
    const mime = (item.mime || '').toLowerCase();

    if (mime.startsWith('image/')) return 'i-file-img';
    if (mime.startsWith('video/')) return 'i-file-vid';
    if (mime.startsWith('audio/')) return 'i-file-aud';

    const img = ['jpg','jpeg','png','gif','webp','bmp','heic','heif','svg','tif','tiff','ico','avif'];
    const vid = ['mp4','mkv','mov','avi','webm','flv','wmv','m4v','3gp','ts','mpeg','mpg'];
    const aud = ['mp3','wav','flac','aac','ogg','m4a','opus','wma','amr','aiff'];
    const doc = ['txt','md','rtf','doc','docx','odt','pages','tex'];
    const xls = ['xls','xlsx','csv','ods','numbers'];
    const ppt = ['ppt','pptx','key','odp'];
    const arc = ['zip','rar','7z','tar','gz','bz2','xz','iso','apk','jar','tgz'];
    const cod = ['js','ts','jsx','tsx','html','htm','css','scss','sass','json','xml','yaml','yml','py','rb','go','rs','java','kt','swift','c','cpp','h','hpp','sh','bash','zsh','php','sql','vue','svelte'];

    if (img.includes(ext)) return 'i-file-img';
    if (vid.includes(ext)) return 'i-file-vid';
    if (aud.includes(ext)) return 'i-file-aud';
    if (ext === 'pdf') return 'i-file-pdf';
    if (doc.includes(ext) || xls.includes(ext) || ppt.includes(ext)) return 'i-file-doc';
    if (arc.includes(ext)) return 'i-file-arc';
    if (cod.includes(ext)) return 'i-file-code';
    return 'i-file';
  }

  /** Modifier class for the icon tile. */
  function iconClassForItem(item) {
    if (!item) return '';
    if (item.isDirectory) return 'file-icon--folder';
    const ext = (item.extension || '').toLowerCase();
    const mime = (item.mime || '').toLowerCase();
    if (mime.startsWith('image/')) return 'file-icon--img';
    if (mime.startsWith('video/')) return 'file-icon--vid';
    if (mime.startsWith('audio/')) return 'file-icon--aud';
    if (ext === 'pdf') return 'file-icon--pdf';
    if (['zip','rar','7z','tar','gz','bz2','xz','iso','apk','jar','tgz'].includes(ext)) return 'file-icon--arc';
    if (['js','ts','jsx','tsx','html','htm','css','scss','sass','json','xml','yaml','yml','py','rb','go','rs','java','kt','swift','c','cpp','h','hpp','sh','bash','zsh','php','sql','vue','svelte'].includes(ext)) return 'file-icon--code';
    if (['jpg','jpeg','png','gif','webp','bmp','heic','heif','svg','tif','tiff','ico','avif'].includes(ext)) return 'file-icon--img';
    if (['mp4','mkv','mov','avi','webm','flv','wmv','m4v','3gp','ts','mpeg','mpg'].includes(ext)) return 'file-icon--vid';
    if (['mp3','wav','flac','aac','ogg','m4a','opus','wma','amr','aiff'].includes(ext)) return 'file-icon--aud';
    if (['txt','md','rtf','doc','docx','odt','pages','tex','xls','xlsx','csv','ods','numbers','ppt','pptx','key','odp'].includes(ext)) return 'file-icon--doc';
    return '';
  }

  /** Path helpers - always forward slashes. */
  function joinPath(parent, name) {
    if (!parent) return name;
    if (parent.endsWith('/')) return parent + name;
    return parent + '/' + name;
  }

  function parentPath(path) {
    if (!path) return '';
    const trimmed = path.replace(/\/+$/, '');
    const idx = trimmed.lastIndexOf('/');
    if (idx <= 0) return '/';
    return trimmed.slice(0, idx);
  }

  function basename(path) {
    if (!path) return '';
    const trimmed = path.replace(/\/+$/, '');
    const idx = trimmed.lastIndexOf('/');
    return idx === -1 ? trimmed : trimmed.slice(idx + 1);
  }

  function splitPath(path) {
    if (!path) return [];
    return path.split('/').filter((p) => p.length > 0);
  }

  global.U = {
    escapeHtml,
    formatBytes,
    formatTime,
    relativeTime,
    longDate,
    iconForItem,
    iconClassForItem,
    joinPath,
    parentPath,
    basename,
    splitPath
  };
})(window);
