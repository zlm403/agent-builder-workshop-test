export default function Home() {
  return (
    <div className="container">
      <h1>AI Agent 互动试听课系统</h1>
      <p className="note">
        Sprint 1 共用课堂底座演示版。当前已实现：课堂创建、二维码入场、模块引擎、教师推进、学生跟随、实时进度、数据落库。
      </p>
      <div className="card">
        <h3>进入对应端</h3>
        <div className="row">
          <a href="/teacher"><button className="secondary">教师导演台</button></a>
          <a href="/student"><button className="secondary">学生互动端</button></a>
          <a href="/screen"><button className="secondary">课堂大屏</button></a>
        </div>
      </div>
      <div className="card">
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
          演示流程：教师创建课堂 → 打开大屏（复制链接带 ?sessionId=）→ 学生扫码/输码进入 → 教师开始并逐环节推进 → 学生在手机完成投票/提交 → 教师端实时看到进度。
        </p>
      </div>
    </div>
  );
}
