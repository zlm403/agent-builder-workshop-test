interface Props {
  anonymousId: string;
}

// 学生端「个人 AI 面试候场室」：不介绍课程，只建立“马上要问到我”的个人感
export default function StudentWaitingRoom({ anonymousId }: Props) {
  return (
    <div className="student-waiting">
      <div className="sw-top">
        <span className="sw-brand">AI 职业能力体验</span>
        <span className="sw-id">已进入 · {anonymousId}</span>
      </div>

      <div className="sw-stage">
        <div className="sw-avatar">
          <div className="sw-frame">
            <svg className="sw-bust" viewBox="0 0 120 120" aria-hidden>
              <defs>
                <linearGradient id="swBust" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#e2e8f0" />
                  <stop offset="1" stopColor="#94a3b8" />
                </linearGradient>
              </defs>
              <circle cx="60" cy="46" r="22" fill="url(#swBust)" />
              <path d="M22 114 C22 84 42 76 60 76 C78 76 98 84 98 114 Z" fill="url(#swBust)" />
              <path d="M52 78 L60 96 L68 78 Z" fill="#0b1220" />
            </svg>
            <span className="sw-ring" />
          </div>
          <div className="sw-connecting">正在接入…</div>
        </div>
      </div>

      <div className="sw-core">
        <div className="sw-title">你的 AI 面试即将开始</div>
        <div className="sw-sub">面试官将请你用一段真实经历，证明自己会使用 AI。</div>
        <div className="sw-fine">没有标准答案，不必包装，请按真实情况回答。</div>
      </div>

      <div className="sw-foot">
        <span className="sw-dot" />
        <span>AI 面试官正在接入…　等待教师开启</span>
      </div>
    </div>
  );
}
