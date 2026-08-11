export default function Home() {
  return (
    <main className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-title-block">
          <h1 id="home-title">AI Agent<br />互动试听课系统</h1>
          <p>
            Sprint 1 共用课堂底座演示版。当前已实现：课堂创建、二维码入场、模块引擎、教师推进、学生跟随、实时进度、数据落库。
          </p>
        </div>
        <div className="home-route" aria-hidden="true">
          <svg viewBox="0 0 760 420" preserveAspectRatio="none" role="presentation">
            <path d="M0 210H250 C316 210 306 72 398 72 H760" />
            <path d="M250 210H760" />
            <path d="M250 210 C316 210 306 348 398 348 H760" />
            <circle cx="250" cy="210" r="7" />
            <circle cx="760" cy="72" r="7" />
            <circle cx="760" cy="210" r="7" />
            <circle cx="760" cy="348" r="7" />
          </svg>
        </div>
      </section>

      <nav className="home-entries" aria-label="进入对应端">
        <a href="/teacher"><span>01</span><strong>教师导演台</strong><b aria-hidden="true">→</b></a>
        <a href="/student"><span>02</span><strong>学生互动端</strong><b aria-hidden="true">→</b></a>
        <a href="/screen"><span>03</span><strong>课堂大屏</strong><b aria-hidden="true">→</b></a>
      </nav>

      <p className="home-flow">
        演示流程：教师创建课堂 → 打开大屏（复制链接带 ?sessionId=）→ 学生扫码/输码进入 → 教师开始并逐环节推进 → 学生在手机完成投票/提交 → 教师端实时看到进度。
      </p>
    </main>
  );
}
