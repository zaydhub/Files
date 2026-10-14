package com.zayd.files;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.StatFs;
import android.provider.Settings;
import android.webkit.MimeTypeMap;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "FilesystemExt")
public class FilesystemExtPlugin extends Plugin {

    @PluginMethod
    public void getStorageRoots(PluginCall call) {
        JSObject ret = new JSObject();
        JSArray roots = new JSArray();
        try {
            File internal = Environment.getExternalStorageDirectory();
            if (internal != null && internal.exists()) {
                JSObject root = new JSObject();
                root.put("name", "Internal Storage");
                root.put("path", internal.getAbsolutePath());
                roots.put(root);
            }
            File[] externalDirs = getContext().getExternalFilesDirs(null);
            if (externalDirs != null && externalDirs.length > 1) {
                for (int i = 1; i < externalDirs.length; i++) {
                    File dir = externalDirs[i];
                    if (dir != null) {
                        String path = dir.getAbsolutePath();
                        int idx = path.indexOf("/Android/");
                        if (idx > 0) {
                            File sdRoot = new File(path.substring(0, idx));
                            if (sdRoot.exists()) {
                                JSObject root = new JSObject();
                                root.put("name", "SD Card");
                                root.put("path", sdRoot.getAbsolutePath());
                                roots.put(root);
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            call.reject(e.getMessage());
            return;
        }
        ret.put("roots", roots);
        call.resolve(ret);
    }

    @PluginMethod
    public void getStandardPaths(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            File ext = Environment.getExternalStorageDirectory();
            ret.put("root", ext.getAbsolutePath());
            ret.put("downloads", new File(ext, "Download").getAbsolutePath());
            ret.put("pictures", new File(ext, "Pictures").getAbsolutePath());
            ret.put("documents", new File(ext, "Documents").getAbsolutePath());
            ret.put("dcim", new File(ext, "DCIM").getAbsolutePath());
            ret.put("movies", new File(ext, "Movies").getAbsolutePath());
            ret.put("music", new File(ext, "Music").getAbsolutePath());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void listDirectory(PluginCall call) {
        String path = call.getString("path", "");
        if (path.isEmpty()) { call.reject("Path required"); return; }
        File dir = new File(path);
        if (!dir.exists()) { call.reject("Directory does not exist"); return; }
        if (!dir.isDirectory()) { call.reject("Not a directory"); return; }
        File[] children = dir.listFiles();
        JSArray items = new JSArray();
        if (children != null) {
            for (File f : children) {
                try {
                    JSObject item = new JSObject();
                    item.put("name", f.getName());
                    item.put("path", f.getAbsolutePath());
                    item.put("isDirectory", f.isDirectory());
                    item.put("size", f.isDirectory() ? 0 : f.length());
                    item.put("modifiedAt", f.lastModified());
                    item.put("isHidden", f.isHidden() || f.getName().startsWith("."));
                    if (!f.isDirectory()) {
                        item.put("mime", getMimeType(f));
                        item.put("extension", getExtension(f.getName()));
                    } else {
                        item.put("mime", "inode/directory");
                        item.put("extension", "");
                    }
                    items.put(item);
                } catch (Exception e) { }
            }
        }
        JSObject ret = new JSObject();
        ret.put("items", items);
        ret.put("path", dir.getAbsolutePath());
        call.resolve(ret);
    }

    @PluginMethod
    public void getStorageInfo(PluginCall call) {
        try {
            File path = Environment.getExternalStorageDirectory();
            StatFs stat = new StatFs(path.getAbsolutePath());
            long blockSize = stat.getBlockSizeLong();
            long totalBlocks = stat.getBlockCountLong();
            long availableBlocks = stat.getAvailableBlocksLong();
            JSObject ret = new JSObject();
            ret.put("total", blockSize * totalBlocks);
            ret.put("free", blockSize * availableBlocks);
            ret.put("used", blockSize * (totalBlocks - availableBlocks));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void createDirectory(PluginCall call) {
        String path = call.getString("path", "");
        if (path.isEmpty()) { call.reject("Path required"); return; }
        File dir = new File(path);
        if (dir.exists()) { call.reject("Already exists"); return; }
        if (dir.mkdirs()) {
            JSObject ret = new JSObject();
            ret.put("path", dir.getAbsolutePath());
            call.resolve(ret);
        } else {
            call.reject("Failed to create directory");
        }
    }

    @PluginMethod
    public void deleteItems(PluginCall call) {
        JSArray paths = call.getArray("paths");
        if (paths == null) { call.reject("Paths required"); return; }
        int deleted = 0, failed = 0;
        try {
            for (int i = 0; i < paths.length(); i++) {
                File f = new File(paths.getString(i));
                if (f.exists() && deleteRecursive(f)) deleted++;
                else failed++;
            }
        } catch (Exception e) {
            call.reject(e.getMessage());
            return;
        }
        JSObject ret = new JSObject();
        ret.put("deleted", deleted);
        ret.put("failed", failed);
        call.resolve(ret);
    }

    private boolean deleteRecursive(File f) {
        if (f.isDirectory()) {
            File[] children = f.listFiles();
            if (children != null) for (File c : children) deleteRecursive(c);
        }
        return f.delete();
    }

    @PluginMethod
    public void renameItem(PluginCall call) {
        String path = call.getString("path", "");
        String newName = call.getString("newName", "");
        if (path.isEmpty() || newName.isEmpty()) { call.reject("Path and newName required"); return; }
        File src = new File(path);
        if (!src.exists()) { call.reject("Source does not exist"); return; }
        File dst = new File(src.getParentFile(), newName);
        if (dst.exists()) { call.reject("Target already exists"); return; }
        if (src.renameTo(dst)) {
            JSObject ret = new JSObject();
            ret.put("path", dst.getAbsolutePath());
            call.resolve(ret);
        } else {
            call.reject("Rename failed");
        }
    }

    @PluginMethod
    public void copyItems(PluginCall call) {
        JSArray sources = call.getArray("sources");
        String destDir = call.getString("destination", "");
        if (sources == null || destDir.isEmpty()) { call.reject("Sources and destination required"); return; }
        File dest = new File(destDir);
        if (!dest.exists() || !dest.isDirectory()) { call.reject("Destination invalid"); return; }
        int copied = 0, failed = 0;
        try {
            for (int i = 0; i < sources.length(); i++) {
                File src = new File(sources.getString(i));
                File dst = new File(dest, src.getName());
                if (copyRecursive(src, dst)) copied++;
                else failed++;
            }
        } catch (Exception e) {
            call.reject(e.getMessage());
            return;
        }
        JSObject ret = new JSObject();
        ret.put("copied", copied);
        ret.put("failed", failed);
        call.resolve(ret);
    }

    private boolean copyRecursive(File src, File dst) {
        try {
            if (src.isDirectory()) {
                if (!dst.exists() && !dst.mkdirs()) return false;
                File[] children = src.listFiles();
                if (children != null) for (File c : children) {
                    if (!copyRecursive(c, new File(dst, c.getName()))) return false;
                }
                return true;
            } else {
                try (InputStream in = new FileInputStream(src);
                     OutputStream out = new FileOutputStream(dst)) {
                    byte[] buf = new byte[8192];
                    int len;
                    while ((len = in.read(buf)) > 0) out.write(buf, 0, len);
                }
                return true;
            }
        } catch (IOException e) { return false; }
    }

    @PluginMethod
    public void moveItems(PluginCall call) {
        JSArray sources = call.getArray("sources");
        String destDir = call.getString("destination", "");
        if (sources == null || destDir.isEmpty()) { call.reject("Sources and destination required"); return; }
        File dest = new File(destDir);
        if (!dest.exists() || !dest.isDirectory()) { call.reject("Destination invalid"); return; }
        int moved = 0, failed = 0;
        try {
            for (int i = 0; i < sources.length(); i++) {
                File src = new File(sources.getString(i));
                File dst = new File(dest, src.getName());
                if (src.renameTo(dst)) moved++;
                else if (copyRecursive(src, dst) && deleteRecursive(src)) moved++;
                else failed++;
            }
        } catch (Exception e) {
            call.reject(e.getMessage());
            return;
        }
        JSObject ret = new JSObject();
        ret.put("moved", moved);
        ret.put("failed", failed);
        call.resolve(ret);
    }

    @PluginMethod
    public void openFile(PluginCall call) {
        String path = call.getString("path", "");
        String mime = call.getString("mime", null);
        if (path.isEmpty()) { call.reject("Path required"); return; }
        File file = new File(path);
        if (!file.exists()) { call.reject("File does not exist"); return; }
        try {
            if (mime == null || mime.isEmpty()) mime = getMimeType(file);
            Uri uri = FileProvider.getUriForFile(getContext(),
                    getContext().getPackageName() + ".fileprovider", file);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, mime);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Cannot open file: " + e.getMessage());
        }
    }

    @PluginMethod
    public void shareFile(PluginCall call) {
        String path = call.getString("path", "");
        String mime = call.getString("mime", null);
        if (path.isEmpty()) { call.reject("Path required"); return; }
        File file = new File(path);
        if (!file.exists()) { call.reject("File does not exist"); return; }
        try {
            if (mime == null || mime.isEmpty()) mime = getMimeType(file);
            Uri uri = FileProvider.getUriForFile(getContext(),
                    getContext().getPackageName() + ".fileprovider", file);
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType(mime);
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getContext().startActivity(Intent.createChooser(intent, "Share"));
            call.resolve();
        } catch (Exception e) {
            call.reject("Cannot share: " + e.getMessage());
        }
    }

    @PluginMethod
    public void requestStoragePermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (Environment.isExternalStorageManager()) { call.resolve(); return; }
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                try {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                    getContext().startActivity(intent);
                    call.resolve();
                } catch (Exception e2) {
                    call.reject("Cannot open settings: " + e2.getMessage());
                }
            }
        } else {
            call.resolve();
        }
    }

    @PluginMethod
    public void checkStoragePermission(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            ret.put("granted", Environment.isExternalStorageManager());
        } else {
            ret.put("granted", true);
        }
        call.resolve(ret);
    }

    private String getMimeType(File file) {
        String name = file.getName();
        int dot = name.lastIndexOf('.');
        if (dot > 0) {
            String ext = name.substring(dot + 1).toLowerCase();
            String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
            if (mime != null) return mime;
        }
        return "application/octet-stream";
    }

    private String getExtension(String name) {
        int dot = name.lastIndexOf('.');
        if (dot > 0) return name.substring(dot + 1).toLowerCase();
        return "";
    }
}
