'use client';
// =========================================================
// 视频本地缓存（IndexedDB）· 供「真·预读」使用
// 进入章节时把视频完整下载存进 IndexedDB，播放时优先取本地 blob，
// 同浏览器再次播放秒开、不再走网络。
// key = 媒体库里的视频源地址（相对路径，如 /videos/xxx.mp4）。
// =========================================================
const DB = 'video-cache';
const STORE = 'videos';
const MAX_VIDEO = 800 * 1024 * 1024; // 单视频上限 800MB，防误存超大文件

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// 完整视频存入缓存；返回是否成功
export async function cacheVideo(key: string, blob: Blob): Promise<boolean> {
  if (blob.size > MAX_VIDEO) return false;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}

// 取已缓存的视频 blob；没有返回 null
export async function getCachedVideo(key: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as Blob) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}
