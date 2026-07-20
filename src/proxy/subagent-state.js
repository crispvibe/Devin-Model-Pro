// 子 Agent 状态存储（HTTP 轮询用，不依赖 WebSocket）
// subagent-executor 写入，hybrid-server /api/subagents 读取
const agents = new Map();
const order = [];
const MAX = 20;

export function subagentStart(rec) {
  const id = rec.agentId;
  if (!agents.has(id)) {
    order.push(id);
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
  // 超限时只清理已完成的，不删 running
  pruneFinished();
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
  // 不自动删除，保留完成状态让 UI 显示所有 Agent
  // 超过上限时自动清理最旧的已完成 Agent
  pruneFinished();
}

function pruneFinished() {
  // 总数超过 MAX 时，从最旧的已完成的开始删
  if (order.length <= MAX) return;
  const finished = order.filter(id => {
    const a = agents.get(id);
    return a && (a.status === 'completed' || a.status === 'failed');
  });
  // 删掉最旧的已完成，直到总数 <= MAX
  while (order.length > MAX && finished.length > 0) {
    const id = finished.shift();
    agents.delete(id);
    const idx = order.indexOf(id);
    if (idx >= 0) order.splice(idx, 1);
  }
}

export function clearSubagents() {
  agents.clear();
  order.length = 0;
}

export function getSubagentList() {
  return order.map(id => agents.get(id)).filter(Boolean);
}
