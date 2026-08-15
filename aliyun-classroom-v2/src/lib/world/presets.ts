// =========================================================
// 《我的世界》预置生命（教师端可一键添加，用于演示/开场合场）
// 张老师鱼缸里的例子生命："我平时挺冷静的，喜欢读书思考，
// 朋友说我有亲和力，但容易焦虑。我比较在意形象，也爱折腾，偶尔讲冷笑话。"
// 形态：粒子生命（中心亮核 + 一圈彩色粒子团）
// =========================================================

export interface LifePreset {
  id: string; // 预置标识
  sid: string; // 用作 anonymousId（与真实学生区分）
  name: string;
  color: string;
  text: string; // 生命定义
  shape: string; // SVG
  desc?: string; // 卡片简介（仅展示用，不参与世界模拟）
}

function particleSvg(color: string, glowColor: string): string {
  const pts = [
    [22, 50], [30, 30], [50, 22], [70, 30], [78, 50],
    [70, 70], [50, 78], [30, 70], [40, 42], [60, 42], [60, 58], [40, 58],
  ];
  const dots = pts
    .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 2 === 0 ? 7 : 5}" fill="${i % 2 === 0 ? color : glowColor}" opacity="${i % 2 === 0 ? 0.9 : 0.65}"/>`)
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">` +
    `<circle cx="50" cy="50" r="30" fill="${color}" opacity="0.18"/>` +
    dots +
    `<circle cx="50" cy="50" r="9" fill="#ffffff" opacity="0.9"/>` +
    `<circle cx="50" cy="50" r="5" fill="${glowColor}"/>` +
    `</svg>`
  );
}

export const LIFE_PRESETS: LifePreset[] = [
  {
    id: 'preset-zhang',
    sid: 'preset_zhang',
    name: '小觉',
    color: '#39d6ff',
    text:
      '它平时挺冷静的，喜欢读书思考。朋友说它有亲和力，但容易焦虑。它在意形象，也爱折腾，偶尔讲冷笑话。',
    shape: particleSvg('#39d6ff', '#7dd3fc'),
    desc: '粒子生命·冷静爱思考，亲和力高，偶尔讲冷笑话（鱼缸例子）',
  },
  {
    id: 'preset-helper',
    sid: 'preset_helper',
    name: '小助',
    color: '#7CFFB2',
    text:
      '它特别热心，看到别人需要就主动帮忙，喜欢守着资源照顾大家，朋友说它像个小太阳。它有点一根筋，偶尔帮过头反而添乱，但从不计较好坏。',
    shape: particleSvg('#7CFFB2', '#bbf7d0'),
    desc: '粒子生命·热心助人，爱守着资源照顾大家，主动靠近其他生命',
  },
];
