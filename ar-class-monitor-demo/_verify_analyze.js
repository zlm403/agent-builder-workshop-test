const A = require('./lib/analyze.js');
(async () => {
  const data = await fetch('http://127.0.0.1:8099/api/class').then(r => r.json());
  for (const task of ['pre', 't1', 't2', 't3']) {
    const bt = data.byTask[task];
    const sids = Object.keys(bt);
    const cells = A.CELLS_BY_TASK[task];
    const counts = cells.map(() => ({}));
    sids.forEach(sid => {
      const r = A.clarityFor(task, bt[sid].events);
      r.grid.forEach((c, i) => { counts[i][c.state] = (counts[i][c.state] || 0) + 1; });
    });
    console.log('=== task', task, '| cells', cells.length, '| students', sids.length);
    const order = ['ok', 'rec', 'guess', 'clarify', 'empty', 'conflict'];
    cells.forEach((c, i) => {
      const cnt = counts[i];
      let best = 'empty', bv = -1;
      order.forEach(k => { if ((cnt[k] || 0) > bv) { bv = cnt[k] || 0; best = k; } });
      const miss = (cnt.guess || 0) + (cnt.clarify || 0) + (cnt.empty || 0) + (cnt.conflict || 0)
        > (cnt.ok || 0) + (cnt.rec || 0);
      console.log(`  ${i + 1}. ${c.name.padEnd(5)} => ${best} ${bv}/${sids.length}${miss ? '  <<GAP 全班短板' : ''}`);
    });
    sids.forEach(sid => {
      const r = A.clarityFor(task, bt[sid].events);
      console.log(`   - ${sid}: score=${r.score} gap=${r.gapCount} clear=${r.clear} missing=[${r.missing.join('/') || '-'}]`);
    });
  }
})();
