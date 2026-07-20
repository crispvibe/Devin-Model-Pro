// 子 Agent 状态存储（HTTP 轮询用，不依赖 WebSocket）
// subagent-executor 写入，hybrid-server /api/subagents 读取
const agents = new Map();
const order = [];
const MAX = 20;

export function subagentStart(rec) {
  const id = rec.agentId;
  if (!agents.has(id)) {
    order.push(id);
    if (order.length > MAX) {
      const old = order.shift();
      agents.delete(old);
    }
  }
  agents.set(id, {
    agentId: id,
    profile: rec.profile || 'subagent_general',
    task: (rec.task || '').slice(0, 500),
    model: rec.model || '',
    provider: rec.provider || '',
    toolCount: rec.toolCount || 0,
    status: 'running',
    turns: 0,
    startedAt: rec.ts || Date.now(),
    endedAt: 0,
    ok: false,
    summary: ''
  });
}

export function subagentTurn(rec) {
  const a = agents.get(rec.agentId);
  if (!a) return;
  a.turns = Math.max(a.turns, (rec.turn || 0) + 1);
}

export function subagentEnd(rec) {
  const a = agents.get(rec.agentId);
  if (!a) return;
  a.status = rec.ok !== false ? 'completed' : 'failed';
  a.ok = rec.ok !== false;
  a.summary = (rec.summary || '').slice(0, 500);
  a.endedAt = rec.ts || Date.now();
  a.turns = rec.turns || a.turns;
  // 5 秒后自动删除，让 UI 看到结束状态后清空
  setTimeout(() => {
    agents.delete(rec.agentId);
    const idx = order.indexOf(rec.agentId);
    if (idx >= 0) order.splice(idx, 1);
  }, 5000);
}

export function clearSubagents() {
  agents.clear();
  order.length = 0;
}

export function getSubagentList() {
  return order.map(id => agents.get(id)).filter(Boolean);
}
