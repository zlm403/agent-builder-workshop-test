// 预览模式判定：URL 带 preview=1（教师端双屏预览 iframe 使用）时，
// 所有视频组件一律不创建 <video>、不预加载、不播放，只渲染占位提示。
// 不带 preview=1 的访问（真大屏 / 正常学生端）行为完全不变。
export function isPreviewMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('preview') === '1';
}
