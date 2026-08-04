'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  COMPANIES,
  SPECIALIST_STYLES,
  RECEPTIONIST_STYLES,
  NAME_POOL,
  GM_CHECKLIST,
  type CompanyTypeKey,
  type Specialist,
  type Receptionist,
  type StudentStep,
} from '@/lib/finaleConfig';

/* ---------- 状态 ---------- */
interface HirePick {
  role: string;
  skill: string;
  style: string;
}

interface ChatMessage {
  role: 'user' | 'recep' | 'spec';
  name: string;
  text: string;
}

/* ---------- CSS Variables（与 demo 一致） ---------- */
const cssVars = {
  bg: '#0b1120',
  panel: '#111a2e',
  panel2: '#16213a',
  line: '#26324d',
  txt: '#e2e8f0',
  sub: '#94a3b8',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#38bdf8',
  orange: '#fb923c',
  purple: '#a78bfa',
  pink: '#f472b6',
};

/* ========== 主组件 ========== */
export default function StudentFinale({ locked = false }: { locked?: boolean }) {
  const [step, setStep] = useState<StudentStep>('company');
  const [company, setCompany] = useState<CompanyTypeKey | null>(null);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [recep, setRecep] = useState<Receptionist | null>(null);

  // 招聘子状态
  const [hireIdx, setHireIdx] = useState(0); // 0-2
  const [hireStage, setHireStage] = useState<'role' | 'skill' | 'style'>('role');
  const [hirePick, setHirePick] = useState<HirePick>({ role: '', skill: '', style: '' });

  // 对话状态
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatPhase, setChatPhase] = useState<'recep' | 'spec' | 'done'>('recep');
  const [recepTurns, setRecepTurns] = useState(0);
  const [specTurns, setSpecTurns] = useState(0);
  const [chatSpec, setChatSpec] = useState<Specialist | null>(null);
  const [firstNeed, setFirstNeed] = useState('');
  const [orderPrice, setOrderPrice] = useState(0);
  const [orderPriceStr, setOrderPriceStr] = useState('');
  const [orderDone, setOrderDone] = useState(false);

  // 输入框引用
  const chatInputRef = useRef<HTMLInputElement>(null);
  const openInputRef = useRef<HTMLInputElement>(null);

  /* ---------- 组织图渲染 ---------- */
  const orgNodes = (() => {
    const nodes: Array<{ label: string; ico: string; on: boolean; recep?: boolean }> = [
      ...specialists.map((e) => ({ label: e.role, ico: '🧑‍💼', on: true })),
    ];
    if (recep) nodes.push({ label: '统一接待员', ico: '🤝', on: true, recep: true });
    while (nodes.length < 4) nodes.push({ label: '待招聘', ico: '○', on: false });
    return nodes.slice(0, 4);
  })();

  /* ---------- STEP 0: 选公司 ---------- */
  const pickCompany = useCallback((k: CompanyTypeKey) => {
    setCompany(k);
    setHireIdx(0);
    setSpecialists([]);
    setRecep(null);
    setStep('hire');
    setHireStage('role');
    setHirePick({ role: '', skill: '', style: '' });
  }, []);

  /* ---------- STEP 1-3: 招专家 ---------- */
  useEffect(() => {
    if (step === 'hire') {
      setHireStage('role');
      setHirePick({ role: '', skill: '', style: '' });
    }
  }, [hireIdx, step]);

  const pickRole = useCallback((r: string) => {
    setHirePick((p) => ({ ...p, role: r }));
    setHireStage('skill');
  }, []);

  const pickSkill = useCallback((s: string) => {
    setHirePick((p) => ({ ...p, skill: s }));
    setHireStage('style');
  }, []);

  const pickStyle = useCallback((s: string) => {
    if (!company) return;
    const nameIdx = (hireIdx * 3 + Math.floor(Math.random() * NAME_POOL.length)) % NAME_POOL.length;
    const emp: Specialist = {
      role: hirePick.role,
      skill: hirePick.skill,
      style: s,
      name: NAME_POOL[nameIdx],
    };
    setSpecialists((prev) => [...prev, emp]);
    setHirePick((p) => ({ ...p, style: s }));
  }, [company, hireIdx, hirePick]);

  const confirmHireNext = useCallback(() => {
    if (hireIdx < 2) {
      setHireIdx((i) => i + 1);
    } else {
      setStep('dup');
    }
  }, [hireIdx]);

  /* ---------- STEP 4: 暴露重复 ---------- */
  const [dupBubbles, setDupBubbles] = useState<number>(0);
  const [showDupWarn, setShowDupWarn] = useState(false);

  useEffect(() => {
    if (step !== 'dup') return;
    setDupBubbles(0);
    setShowDupWarn(false);
    const timers: ReturnType<typeof setTimeout>[] = [];
    specialists.forEach((_, i) => {
      timers.push(setTimeout(() => setDupBubbles((n) => n + 1), 400 * (i + 1)));
    });
    timers.push(setTimeout(() => setShowDupWarn(true), 400 * (specialists.length + 1)));
    return () => timers.forEach(clearTimeout);
  }, [step, specialists.length]);

  const goDupToRecep = useCallback(() => setStep('recep'), []);

  /* ---------- STEP 5: 招接待员 ---------- */
  const [recepPicked, setRecepPicked] = useState(false);

  const pickRecep = useCallback((k: string, s: string) => {
    setRecep({
      role: '统一接待员',
      style: k,
      styleDesc: s,
      routes: specialists.map((e) => e.role),
      name: '小迎',
    });
    setRecepPicked(true);
  }, [specialists]);

  const confirmRecep = useCallback(() => setStep('gm'), []);

  /* ---------- STEP 6: GM 检查 ---------- */
  const [gmChecked, setGmChecked] = useState(0);
  const [showGmBa, setShowGmBa] = useState(false);

  useEffect(() => {
    if (step !== 'gm') return;
    setGmChecked(0);
    setShowGmBa(false);
    const timers: ReturnType<typeof setTimeout>[] = [];
    GM_CHECKLIST.forEach((_, i) => {
      timers.push(setTimeout(() => setGmChecked((n) => n + 1), 500 * (i + 1)));
    });
    timers.push(
      setTimeout(() => setShowGmBa(true), 500 * GM_CHECKLIST.length + 300),
    );
    return () => timers.forEach(clearTimeout);
  }, [step]);

  const gmOpen = useCallback(() => setStep('open'), []);

  /* ---------- STEP 7: 开业对话 ---------- */
  const [flowActiveStep, setFlowActiveStep] = useState(-1);
  const [openStarted, setOpenStarted] = useState(false);
  const [chatInput, setChatInput] = useState('');

  const startOpenChat = useCallback(() => {
    const txt = openInputRef.current?.value.trim() || '';
    if (!txt) return;
    setFirstNeed(txt);
    setOpenStarted(true);
    setFlowActiveStep(0);

    // 动画推进流程条
    const steps = ['客户进入', '接待员了解需求', '识别品类', '转交专业员工', '专业服务 + 收款'];
    steps.forEach((_, i) => {
      setTimeout(() => setFlowActiveStep(i), 400 * (i + 1));
    });

    // 启动对话
    setTimeout(() => {
      const msg: ChatMessage = {
        role: 'recep',
        name: '🤝 小迎（前台）',
        text: `你好，我是小迎，${company ? COMPANIES[company].name : '公司'}的统一接待员。我看到你想：「${txt}」——先跟你聊两句，好给你找对专家 😊`,
      };
      setChatMessages([msg]);
      setChatPhase('recep');
      setRecepTurns(1);
    }, 400 * steps.length);
  }, [company]);

  // 关键词匹配专家
  const pickSpecFromText = useCallback(
    (text: string): Specialist | null => {
      for (const e of specialists) {
        const key = e.role.replace(/顾问|老师|师/g, '');
        if (text.includes(key)) return e;
      }
      for (const e of specialists) {
        if (text.includes(e.skill)) return e;
      }
      return null;
    },
    [specialists],
  );

  const sendChat = useCallback(() => {
    const v = chatInput.trim();
    if (!v) return;
    setChatInput('');

    const userMsg: ChatMessage = { role: 'user', name: '🙋 你', text: v };
    setChatMessages((prev) => [...prev, userMsg]);

    if (chatPhase === 'recep') {
      // 接待员回复逻辑
      const cand = pickSpecFromText(v);
      let spec = chatSpec;
      if (cand) spec = cand;

      let newRecepTurns = recepTurns + 1;
      let shouldTransfer = false;

      if (!spec && newRecepTurns >= 3) {
        spec = specialists[0]; // 兜底
      }
      if (newRecepTurns >= 2 && spec) {
        shouldTransfer = true;
      }

      setRecepTurns(newRecepTurns);
      if (spec) setChatSpec(spec);

      if (shouldTransfer && spec) {
        setTimeout(() => {
          const transferMsg: ChatMessage = {
            role: 'recep',
            name: '🤝 小迎（前台）',
            text: `聊得差不多了～你这个需求最适合我们的【${spec.name}·${spec.role}】，我直接帮你转接过去 👉`,
          };
          setChatMessages((prev) => [...prev, transferMsg]);

          setTimeout(() => {
            const transMsg: ChatMessage = {
              role: 'recep',
              name: '🤝 小迎（前台）',
              text: '（转接中…已把你的需求交给专家）',
            };
            setChatMessages((prev) => [...prev, transMsg]);
            setChatPhase('spec');

            setTimeout(() => {
              const specMsg: ChatMessage = {
                role: 'spec',
                name: `🧑‍💼 ${spec.name}`,
                text: `你好，我是${spec.name}（${spec.role}）。小迎刚把「${firstNeed}」转给我，你具体想怎么搞定它？跟我说说细节～`,
              };
              setChatMessages((prev) => [...prev, specMsg]);
              setSpecTurns(1);
            }, 700);
          }, 700);
        }, 600);
        return;
      }

      // 继续追问
      const qs = [
        `关于「${v}」，方便说下预算或大概场景吗？`,
        `「${v}」——这个主要用在什么场合呢？`,
        `收到「${v}」。再补一句：你最在意效果、价格还是速度？`,
        `「${v}」记下了，还有没有特别偏好，比如对象、风格、时间点？`,
      ];
      setTimeout(() => {
        const reply: ChatMessage = {
          role: 'recep',
          name: '🤝 小迎（前台）',
          text: qs[Math.min(newRecepTurns - 1, qs.length - 1)],
        };
        setChatMessages((prev) => [...prev, reply]);
      }, 600);
    } else {
      // 专家回复逻辑
      const newSpecTurns = specTurns + 1;
      setSpecTurns(newSpecTurns);

      if (newSpecTurns >= 2) {
        setTimeout(() => deliverPlan(chatSpec!), 600);
        return;
      }

      const qs = [
        `「${v}」我get到了。为了方案更准，能再说说你的具体情况吗？`,
        `明白了「${v}」。你希望我重点帮你解决哪一块？`,
        `好的「${v}」。有没有 deadline 或者特别偏好？`,
      ];
      setTimeout(() => {
        const reply: ChatMessage = {
          role: 'spec',
          name: `🧑‍💼 ${chatSpec?.name || '专家'}`,
          text: qs[newSpecTurns - 1],
        };
        setChatMessages((prev) => [...prev, reply]);
      }, 600);
    }
  }, [
    chatInput,
    chatPhase,
    recepTurns,
    specTurns,
    chatSpec,
    firstNeed,
    specialists,
    pickSpecFromText,
  ]);

  // 出方案
  const deliverPlan = useCallback(
    (spec: Specialist) => {
      if (!company) return;
      const c = COMPANIES[company];
      let price: number;
      let items: [string, string][];
      const r = Math.random;

      if (c.name === 'AI好物店') {
        price = 80 + Math.floor(r() * 220);
        items = [
          ['推荐方案', `${spec.skill}：精选 1 件主礼物 + 1 件惊喜小物`],
          ['价格', `¥${price}（含包装与贺卡）`],
          ['时间安排', '今天 18:00 前下单，明天送达'],
          ['交付物', '实物礼物 + 手写贺卡 + 避坑清单'],
        ];
      } else if (c.name === 'AI学习中心') {
        price = 199 + Math.floor(r() * 400);
        items = [
          ['诊断', '先用 10 题定位你的薄弱点'],
          ['方案', `${spec.skill}：3 次 1 对 1 精讲`],
          ['价格', `¥${price}（含练习册与错题本）`],
          ['时间安排', '本周起每周二/四晚 60 分钟'],
        ];
      } else {
        price = parseFloat((9.9 + r() * 90).toFixed(1));
        items = [
          ['定制方案', `${spec.skill}：一套可直接开玩的脚本`],
          ['价格', `¥${price}（含主持词与道具清单）`],
          ['时间安排', '现在就能玩，约 40 分钟'],
          ['交付物', '游戏流程 + 分组规则 + 奖惩机制'],
        ];
      }
      const priceStr = items.find((i) => i[0] === '价格')?.[1] || `¥${price}`;
      setOrderPrice(price);
      setOrderPriceStr(priceStr);
      setChatPhase('done');
    },
    [company],
  );

  // 付款确认
  const confirmPay = useCallback(() => {
    setOrderDone(true);
    setTimeout(() => setStep('share'), 1000);
  }, []);

  /* ---------- STEP 8: 分享 + 自由体验 ---------- */
  const continueSame = useCallback(() => {
    // 重置对话状态，回到开业
    setChatMessages([]);
    setChatPhase('recep');
    setRecepTurns(0);
    setSpecTurns(0);
    setChatSpec(null);
    setFirstNeed('');
    setOrderPrice(0);
    setOrderPriceStr('');
    setOrderDone(false);
    setOpenStarted(false);
    setFlowActiveStep(-1);
    setStep('open');
  }, []);

  const playAnother = useCallback(() => {
    setCompany(null);
    setSpecialists([]);
    setRecep(null);
    setHireIdx(0);
    setHireStage('role');
    setHirePick({ role: '', skill: '', style: '' });
    setRecepPicked(false);
    setChatMessages([]);
    setChatPhase('recep');
    setRecepTurns(0);
    setSpecTurns(0);
    setChatSpec(null);
    setFirstNeed('');
    setOrderPrice(0);
    setOrderPriceStr('');
    setOrderDone(false);
    setOpenStarted(false);
    setFlowActiveStep(-1);
    setStep('company');
  }, []);

  /* ========== 渲染 ========== */
  const c = company ? COMPANIES[company] : null;

  // 教师锁定时，学生端显示占位页（讲解中，等教师点"解锁"再自由玩）
  if (locked) {
    return (
      <div style={{
        fontFamily: '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif',
        background: 'radial-gradient(1200px 600px at 50% -10%,#13203a,#0b1120 60%)',
        color: cssVars.txt, minHeight: '100vh', padding: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 520 }}>
          <div style={{ fontSize: 56, marginBottom: 18 }}>👀</div>
          <h2 style={{ fontSize: 28, marginBottom: 10 }}>老师正在讲解</h2>
          <p style={{ color: cssVars.sub, fontSize: 16, lineHeight: 1.7 }}>
            请先看大屏。老师讲完「公司是怎么长大的」之后，这里会自动解锁，你就能开始组建自己的 AI 公司。
          </p>
          <div style={{
            marginTop: 24, display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '10px 20px', borderRadius: 999,
            background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.3)',
            color: cssVars.blue, fontSize: 14,
          }}>
            <span style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
              background: cssVars.blue,
            }} />
            等待老师释放…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif',
      background: 'radial-gradient(1200px 600px at 50% -10%,#13203a,#0b1120 60%)',
      color: cssVars.txt,
      minHeight: '100vh',
      padding: 24,
      display: 'flex',
      justifyContent: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: 880 }}>
        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.5 }}>
            我的<span style={{ color: cssVars.yellow }}>AI</span>公司
          </div>
          <div style={{
            fontSize: 12, color: cssVars.sub, border: `1px solid ${cssVars.line}`,
            padding: '2px 8px', borderRadius: 20,
          }}>
            {c ? c.name : company ? '已选公司' : '一人公司'}
          </div>
        </div>

        {/* Org chart */}
        <div style={{ display: 'flex', gap: 10, margin: '18px 0 8px', flexWrap: 'wrap' as never }}>
          {orgNodes.map((n, i) => (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              opacity: n.on ? 1 : 0.35, transition: '0.3s',
            }}>
              <div style={{
                width: 46, height: 46, borderRadius: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, background: cssVars.panel2,
                border: n.recep
                  ? `1px solid ${cssVars.yellow}`
                  : n.on
                    ? `1px solid ${cssVars.green}`
                    : `1px solid ${cssVars.line}`,
                boxShadow: n.recep
                  ? '0 0 0 3px rgba(234,179,8,.15)'
                  : n.on
                    ? '0 0 0 3px rgba(34,197,94,.15)'
                    : 'none',
              }}>{n.ico}</div>
              <div style={{
                fontSize: 11, color: n.on ? cssVars.txt : cssVars.sub,
                maxWidth: 60, textAlign: 'center', lineHeight: 1.3,
              }}>{n.label}</div>
            </div>
          ))}
        </div>

        {/* ===== STEP 0: 选公司 ===== */}
        {step === 'company' && (
          <Card kicker="开始" title="接下来，组建你自己的 AI 公司"
            desc="业务不同，但组建公司的方法相同：招聘专业员工，再增加统一前台。">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
              {(Object.entries(COMPANIES) as [CompanyTypeKey, typeof COMPANIES[CompanyTypeKey]][]).map(([k, v]) => (
                <button key={k} onClick={() => pickCompany(k)} style={optStyle}>
                  <div style={{ fontSize: 24 }}>{v.icon}</div>
                  <div style={{ fontWeight: 700, marginTop: 6 }}>{v.name}</div>
                  <div style={{ fontSize: 12, color: cssVars.sub, marginTop: 4, lineHeight: 1.4 }}>{v.desc}</div>
                </button>
              ))}
            </div>
            <Progress label={`第 0 步 / 共 7 步`} pct={0} />
          </Card>
        )}

        {/* ===== STEP 1-3: 招专家 ===== */}
        {step === 'hire' && c && (
          <Card
            kicker={`招聘专业员工 · 第 ${hireIdx + 1} 名`}
            title={[
              '第一名员工（把你的全能员工改造成专家）',
              '第二名员工（复制方法，换专业能力）',
              '第三名员工（再复制一名专家）',
            ][hireIdx]}
            desc={
              hireIdx === 0
                ? '你已经有了第一名会干活的 AI 员工。现在，决定让他专门负责什么。'
                : '复制第一名员工的服务方法，再换上新的专业能力。只选三件事，AI 帮你生成完整档案。'
            }
          >
            {specialists.length > hireIdx ? (
              /* 已选完当前专家，展示结果卡 */
              <div style={{ width: '100%' }}>
                <EmpCard emp={specialists[hireIdx]} />
                <div style={{ color: cssVars.sub, fontSize: 13 }}>
                  ✓ 员工已就位，AI 已生成完整档案（职责/规则/交接在后台）。
                </div>
              </div>
            ) : hireStage === 'role' ? (
              /* 选岗位 */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                {c.specialists.map((r) => (
                  <button key={r} onClick={() => pickRole(r)} style={optStyle}>
                    <div style={{ fontWeight: 700 }}>{r}</div>
                    <div style={{ fontSize: 12, color: cssVars.sub, marginTop: 4 }}>
                      {hireIdx === 0 ? `把全能员工培养成` : `新增一名`} {r}
                    </div>
                  </button>
                ))}
              </div>
            ) : hireStage === 'skill' ? (
              /* 选技能 */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                {c.skills[hirePick.role]?.map((s) => (
                  <button key={s} onClick={() => pickSkill(s)} style={optStyle}>
                    <div style={{ fontWeight: 700 }}>{s}</div>
                    <div style={{ fontSize: 12, color: cssVars.sub, marginTop: 4 }}>王牌能力</div>
                  </button>
                ))}
              </div>
            ) : (
              /* 选风格 */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                {SPECIALIST_STYLES.map((s) => (
                  <button key={s} onClick={() => pickStyle(s)} style={optStyle}>
                    <div style={{ fontWeight: 700 }}>{s}</div>
                    <div style={{ fontSize: 12, color: cssVars.sub, marginTop: 4 }}>工作风格</div>
                  </button>
                ))}
              </div>
            )}
            <div style={{ row: 'flex', gap: 10, flexWrap: 'wrap' as never, marginTop: 'auto', paddingTop: 18, display: 'flex' }}>
              <button
                style={{ ...btnStyle, opacity: specialists.length > hireIdx ? 1 : 0.4 }}
                disabled={specialists.length <= hireIdx}
                onClick={confirmHireNext}
              >
                确认，{hireIdx < 2 ? '招聘下一名 →' : '进入下一步 →'}
              </button>
            </div>
            <Progress label={`公司组建进度：${Math.min(specialists.length, 3)} / 3`} pct={(Math.min(specialists.length, 3) / 3) * 100} />
          </Card>
        )}

        {/* ===== STEP 4: 暴露重复 ===== */}
        {step === 'dup' && (
          <Card kicker="模拟客户进入公司" title="正在模拟客户进入公司……"
            desc="你的 3 名专业员工都在门口准备接客。">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '10px 0' }}>
              {specialists.slice(0, dupBubbles).map((e, i) => (
                <div key={i} style={{
                  background: cssVars.panel2, border: `1px solid ${cssVars.line}`,
                  borderRadius: 10, padding: '10px 14px', fontSize: 14, color: cssVars.txt,
                }}>
                  <b style={{ color: cssVars.orange }}>{e.name}（{e.role}）：</b>你好，请问你需要什么帮助？
                </div>
              ))}
            </div>
            {showDupWarn && (
              <div style={{
                background: 'rgba(251,146,60,.12)', border: '1px solid rgba(251,146,60,.5)',
                borderRadius: 14, padding: 18, color: '#fdba74', fontWeight: 700,
                margin: '14px 0', textAlign: 'center',
              }}>
                ⚠ 发现重复工作：3 名专业员工都在重复接待客户，专业时间正在被浪费。
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as never, marginTop: 'auto', paddingTop: 18, display: 'flex' }}>
              {showDupWarn && (
                <button style={{ ...btnStyle, background: cssVars.yellow, color: '#3a2c00' }} onClick={goDupToRecep}>
                  把重复工作交给一名公共员工
                </button>
              )}
            </div>
          </Card>
        )}

        {/* ===== STEP 5: 招接待员 ===== */}
        {step === 'recep' && (
          <Card kicker="招聘第 4 名员工" title="统一接待员"
            desc="他的岗位由系统决定——统一接待所有人，再按需求转给对的专家。">
            {recep ? (
              <div style={{ width: '100%' }}>
                <div style={{
                  display: 'flex', gap: 14, alignItems: 'center',
                  background: cssVars.panel2, border: `1px solid ${cssVars.line}`,
                  borderRadius: 14, padding: 16, marginBottom: 10,
                }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: `linear-gradient(135deg,${cssVars.purple},${cssVars.blue})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, fontWeight: 800, color: '#fff',
                  }}>🤝</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 17 }}>小迎｜统一接待员</div>
                    <div style={{ color: cssVars.sub, fontSize: 13, marginTop: 3 }}>接待方式：{recep.style}</div>
                    <div style={{ color: cssVars.green }}>
                      已认识：{recep.routes.join(' / ')}，按需求自动转交
                    </div>
                  </div>
                </div>
                <div style={{ color: cssVars.sub, fontSize: 13 }}>
                  ✓ 他认识你的全部员工——不是一个新聊天机器人，而是公司前台。
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {RECEPTIONIST_STYLES.map((rs) => (
                  <button key={rs.key} onClick={() => pickRecep(rs.key, rs.s!)} style={optStyle}>
                    <div style={{ fontWeight: 700 }}>{rs.key}</div>
                    <div style={{ fontSize: 12, color: cssVars.sub, marginTop: 4 }}>{rs.s}</div>
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as never, marginTop: 'auto', paddingTop: 18, display: 'flex' }}>
              <button style={{ ...btnStyle, opacity: recepPicked ? 1 : 0.4 }} disabled={!recepPicked} onClick={confirmRecep}>
                确认入职 →
              </button>
            </div>
          </Card>
        )}

        {/* ===== STEP 6: GM 整顿 ===== */}
        {step === 'gm' && (
          <Card kicker="开业前检查" title="请 AI 总经理整顿公司"
            desc="不用你改配置，AI 总经理自动检查并优化组织。">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
              {GM_CHECKLIST.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, color: cssVars.sub, fontSize: 14 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    border: `1px solid ${cssVars.line}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                    background: i < gmChecked ? 'rgba(34,197,94,.2)' : 'transparent',
                    borderColor: i < gmChecked ? cssVars.green : cssVars.line,
                    color: i < gmChecked ? cssVars.green : 'inherit',
                  }}>
                    {i < gmChecked ? '✓' : '○'}
                  </div>
                  <span style={{ color: i < gmChecked ? cssVars.txt : undefined }}>{item}</span>
                </div>
              ))}
            </div>
            {showGmBa && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div style={{ border: `1px solid ${cssVars.line}`, borderRadius: 12, padding: 14, fontSize: 13, lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6, color: cssVars.orange }}>优化前</div>
                  三名专业员工都负责接待和判断客户需求。
                </div>
                <div style={{ border: `1px solid ${cssVars.line}`, borderRadius: 12, padding: 14, fontSize: 13, lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6, color: cssVars.green }}>优化后</div>
                  接待员统一了解客户；专业员工只处理自己擅长的问题；需求由接待员自动分配。
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as never, marginTop: 'auto', paddingTop: 18, display: 'flex' }}>
              {showGmBa && (
                <button style={btnStyle} onClick={gmOpen}>
                  接受优化，正式开业 🎉
                </button>
              )}
            </div>
          </Card>
        )}

        {/* ===== STEP 7: 开业对话 ===== */}
        {step === 'open' && c && (
          <Card kicker="开业首单" title="说一个真实需求，看公司怎么接"
            desc="用大白话描述你要解决的事，接待员会先跟你聊，再转给对的专家。">
            {/* 流程条 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as never,
              margin: '16px 0', justifyContent: 'center',
            }}>
              {['客户进入', '接待员了解需求', '识别品类', '转交专业员工', '专业服务 + 收款'].map((s, i) => (
                <span key={i}>
                  <div style={{
                    background: cssVars.panel2, border: `1px solid ${cssVars.line}`,
                    borderRadius: 10, padding: '10px 14px', fontSize: 14,
                    opacity: flowActiveStep >= i ? 1 : 0.4,
                    borderColor: flowActiveStep >= i ? cssVars.green : cssVars.line,
                    boxShadow: flowActiveStep >= i ? '0 0 0 3px rgba(34,197,94,.15)' : 'none',
                    transition: '0.3s', display: 'inline-block',
                  }}>{s}</div>
                  {i < 4 && <span style={{ color: cssVars.sub }}>→</span>}
                </span>
              ))}
            </div>

            {/* 需求输入（未开始时显示） */}
            {!openStarted && (
              <>
                <input ref={openInputRef}
                  style={{
                    width: '100%', padding: 12, color: cssVars.txt,
                    background: cssVars.panel2, border: `1px solid ${cssVars.line}`,
                    borderRadius: 10, fontSize: 15, outline: 'none',
                  }}
                  placeholder="例如：预算300元，想给喜欢摄影的朋友买生日礼物"
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 10, display: 'flex' }}>
                  <button style={btnStyle} onClick={startOpenChat}>发送需求</button>
                </div>
              </>
            )}

            {/* 对话区域 */}
            {(chatMessages.length > 0 || openStarted) && (
              <div>
                <div style={{ margin: '18px 0 6px', color: cssVars.blue, fontSize: 13, fontWeight: 700 }}>
                  💬 实时对话（自由输入，自动推进）
                </div>
                <div style={{
                  border: `1px solid ${cssVars.line}`, borderRadius: 14,
                  padding: 16, background: cssVars.panel2,
                  minHeight: 140, maxHeight: 380, overflow: 'auto',
                }}>
                  {chatMessages.map((msg, i) => (
                    <div key={i} style={{
                      background: cssVars.panel2,
                      border: `1px solid ${cssVars.line}`, borderRadius: 10,
                      padding: '10px 14px', fontSize: 14, color: cssVars.txt,
                      margin: '8px 0', textAlign: msg.role === 'user' ? 'right' as const : 'left' as const,
                    }}>
                      <div style={{ color: cssVars.sub, fontSize: 12 }}>{msg.name}</div>
                      <div style={{ marginTop: 2 }}>{msg.text}</div>
                    </div>
                  ))}
                </div>

                {/* 方案卡片 */}
                {chatPhase === 'done' && orderPriceStr && (
                  <div style={{
                    marginTop: 12, border: `1px solid ${cssVars.green}`,
                    borderRadius: 12, padding: 14,
                    background: 'rgba(34,197,94,.06)',
                  }}>
                    <b style={{ color: cssVars.green }}>
                      📋 {chatSpec?.name || '专家'} 给出的方案（针对「{firstNeed}」）
                    </b>
                    {[
                      ['推荐方案', `${chatSpec?.skill || ''}：精选方案`],
                      ['价格', orderPriceStr],
                      ['时间安排', '尽快安排'],
                      ['交付物', '完整交付物'],
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, fontSize: 14, margin: '6px 0' }}>
                        <span style={{ color: cssVars.blue, minWidth: 64 }}>{item[0]}</span>
                        <span>{item[1]}</span>
                      </div>
                    ))}
                    <div style={{ color: cssVars.sub, fontSize: 13, marginTop: 8 }}>
                      确认的话，扫码付款我就正式开工 💪
                    </div>
                  </div>
                )}

                {/* 聊天输入框 */}
                {chatPhase !== 'done' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <input ref={chatInputRef} value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }}
                      style={{
                        flex: 1, padding: 12, color: cssVars.txt,
                        background: cssVars.panel2, border: `1px solid ${cssVars.line}`,
                        borderRadius: 10, fontSize: 15, outline: 'none',
                      }}
                      placeholder="输入你的回复…"
                    />
                    <button style={btnStyle} onClick={sendChat}>发送</button>
                  </div>
                )}

                {/* 付款按钮 */}
                {chatPhase === 'done' && !orderDone && (
                  <div style={{ marginTop: 14, textAlign: 'center' }}>
                    <button style={{ ...btnStyle, width: '100%', background: cssVars.yellow, color: '#3a2c00' }}
                      onClick={() => setOrderDone(true)}>
                      📱 扫码付款 {orderPriceStr}
                    </button>
                    {orderDone !== undefined && orderDone === false && (
                      <div style={{ marginTop: 12, textAlign: 'center' }}>
                        <div style={{
                          display: 'inline-block', width: 140, height: 140,
                          background: `
                            repeating-linear-gradient(0deg,#0b1120 0 6px,#e2e8f0 6px 12px),
                            repeating-linear-gradient(90deg,#0b1120 0 6px,#e2e8f0 6px 12px)
                          `,
                          backgroundBlendMode: 'difference',
                          borderRadius: 10,
                        }} />
                        <div style={{ color: cssVars.sub, fontSize: 13, marginTop: 8 }}>
                          请用手机扫码支付 {orderPriceStr}
                        </div>
                        <button style={{ ...btnStyle, marginTop: 10 }} onClick={confirmPay}>
                          我扫完了，确认收款
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 已收款 */}
                {orderDone && (
                  <div style={{ marginTop: 12, color: cssVars.green, fontWeight: 800, textAlign: 'center' }}>
                    ✅ 已收款 ¥{orderPrice}，订单完成！收钱才算完工 🎉
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* ===== STEP 8: 分享卡片 ===== */}
        {step === 'share' && c && (
          <Card isCenter>
            <div style={{
              background: 'linear-gradient(135deg,#1e293b,#0f172a)',
              border: `1px solid ${cssVars.yellow}`, borderRadius: 18, padding: 24, textAlign: 'center', width: '100%',
            }}>
              <div style={{
                display: 'inline-block', background: cssVars.yellow, color: '#3a2c00',
                fontWeight: 800, borderRadius: 20, padding: '4px 14px', fontSize: 13, marginBottom: 12,
              }}>🏢 正式开业</div>
              <h3 style={{ fontSize: 22, marginBottom: 4 }}>{c.name}</h3>
              <div style={{ color: cssVars.sub, fontSize: 14, marginBottom: 16 }}>老板：你</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '14px 0' }}>
                {[recep!, ...specialists].filter(Boolean).map((e, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between',
                    background: cssVars.panel2, border: `1px solid ${cssVars.line}`,
                    borderRadius: 10, padding: '10px 14px', fontSize: 14,
                  }}>
                    <span>{e.name}｜{e.role}</span>
                    <span style={{ color: cssVars.sub }}>
                      {e.role === '统一接待员' ? '统一接待·分流' : 'skill' in e ? e.skill : ''}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ color: cssVars.sub, fontSize: 13, marginTop: 6 }}>
                今日进展：已成功接待客户并收款 <b style={{ color: cssVars.green }}>¥{orderPrice}</b> ✓
              </div>
            </div>
            <div style={{ marginTop: 18 }}>
              <div style={{ color: cssVars.yellow, fontWeight: 700, marginBottom: 10 }}>
                🎮 自由体验时间（再玩几单，或换家公司）
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 10, display: 'flex' }}>
                <button style={btnStyle} onClick={continueSame}>↻ 继续聊这家公司</button>
                <button style={{ ...btnStyle, background: 'transparent', border: `1px solid ${cssVars.line}`, color: cssVars.txt }} onClick={playAnother}>
                  🏢 换一家公司玩
                </button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ========== 子组件 ========== */

function Card({
  children,
  kicker,
  title,
  desc,
  isCenter,
}: {
  children?: React.ReactNode;
  kicker?: string;
  title?: string;
  desc?: string;
  isCenter?: boolean;
}) {
  return (
    <div style={{
      background: `linear-gradient(180deg,${cssVars.panel},${cssVars.panel2})`,
      border: `1px solid ${cssVars.line}`, borderRadius: 18,
      padding: '26px 24px', minHeight: 340,
      display: 'flex', flexDirection: 'column',
      alignItems: isCenter ? 'center' : 'stretch',
      textAlign: isCenter ? 'center' : 'left',
    }}>
      {kicker && <div style={{ color: cssVars.blue, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>{kicker}</div>}
      {title && <h2 style={{ fontSize: 24, marginBottom: 6 }}>{title}</h2>}
      {desc && <div style={{ color: cssVars.sub, fontSize: 15, marginBottom: 18, lineHeight: 1.6 }}>{desc}</div>}
      {children}
    </div>
  );
}

function EmpCard({ emp }: { emp: Specialist }) {
  const [name, setName] = useState(emp.name);
  const rename = () => {
    const idx = Math.floor(Math.random() * NAME_POOL.length);
    setName(NAME_POOL[idx]);
  };
  return (
    <div style={{ width: '100%' }}>
      <div style={{
        display: 'flex', gap: 14, alignItems: 'center',
        background: cssVars.panel2, border: `1px solid ${cssVars.line}`,
        borderRadius: 14, padding: 16, marginBottom: 10,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: `linear-gradient(135deg,${cssVars.purple},${cssVars.blue})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 800, color: '#fff',
        }}>{name[0]}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{name}｜{emp.role}</div>
          <div style={{ color: cssVars.sub, fontSize: 13, marginTop: 3 }}>王牌：{emp.skill} · 风格：{emp.style}</div>
          <div style={{ color: cssVars.sub, fontSize: 13, marginTop: 3 }}>服务流程：了解对象 → 询问预算 → 分析兴趣 → 推荐方案 → 解释理由</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button style={{
            background: cssVars.panel, border: `1px solid ${cssVars.line}`,
            color: cssVars.sub, borderRadius: 8, padding: '6px 10px',
            fontSize: 12, cursor: 'pointer',
          }} onClick={rename}>换个名字</button>
        </div>
      </div>
    </div>
  );
}

function Progress({ label, pct }: { label: string; pct: number }) {
  return (
    <div style={{ marginTop: 14, color: cssVars.sub, fontSize: 13 }}>
      {label}
      <div style={{
        height: 6, background: cssVars.panel2, borderRadius: 6,
        marginTop: 6, overflow: 'hidden',
      }}>
        <i style={{ display: 'block', height: '100%', background: cssVars.green, width: `${pct}%`, transition: '0.4s' }} />
      </div>
    </div>
  );
}

/* ========== 共享样式常量 ========== */
const optStyle: React.CSSProperties = {
  background: cssVars.panel2,
  border: `1px solid ${cssVars.line}`,
  borderRadius: 12,
  padding: 16,
  cursor: 'pointer',
  transition: '0.15s',
  textAlign: 'left' as const,
  color: cssVars.txt,
};

const btnStyle: React.CSSProperties = {
  background: cssVars.green,
  color: '#06210f',
  border: 'none',
  borderRadius: 10,
  padding: '12px 20px',
  fontWeight: 800,
  fontSize: 15,
  cursor: 'pointer',
};
