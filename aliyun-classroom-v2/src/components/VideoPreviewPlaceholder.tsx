// 视频占位提示：预览小屏（iframe 带 preview=1）里一律不创建/不预加载/不播放 <video>，
// 只显示提示，避免教师端预览小屏同时拉取多个视频源（真大屏/学生端正常播放不受影响）。
// 纯展示组件，无内部环节编号（铁律：面向学生/大屏的文案一律不出现编号）。
export default function VideoPreviewPlaceholder() {
  return (
    <div
      style={{
        height: 120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.6)',
        borderRadius: 12,
        color: '#94a3b8',
        fontSize: 14,
        letterSpacing: 1,
      }}
    >
      🎬 视频在真大屏播放中
    </div>
  );
}
