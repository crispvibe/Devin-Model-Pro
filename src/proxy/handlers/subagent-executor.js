// BYOK 本地子 Agent 执行器
// 客户端 BYOK 模式不创建子 Agent，run_subagent 永远返回 "No subagent found"。
// 这里在插件本地跑一个 LLM 循环 + 工具执行，复用主 Agent 的工具定义和 BYOK 模型配置。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import { searchDuckDuckGo, isAllowedUrl } from './web-search.js';
import { getSubagentPrompt } from './subagent-prompts.js';
import { getProviderConfig } from './models.js';
import { toChatCompletionsMessages, toChatCompletionsPath } from './openai-request.js';
import { emitSubagentStart, emitSubagentTurn, emitSubagentToolExec, emitSubagentToolResult, emitSubagentEnd } from '../ws-bridge.js';
import { subagentStart, subagentTurn, subagentEnd } from '../subagent-state.js';

const execAsync = promisify(execCb);
const MAX_TURNS = parseInt(process.env.BYOK_SUBAGENT_MAX_TURNS || '20', 10);
const MAX_OUTPUT = parseInt(process.env.BYOK_SUBAGENT_MAX_OUTPUT || '50000', 10);
const REQUEST_TIMEOUT = parseInt(process.env.BYOK_SUBAGENT_TIMEOUT || '120000', 10);

// 子 Agent 可用的工具白名单（排除会递归或需要用户交互的）
// skill 已暴露但 toolSkill 仅支持 list 模式，invoke 返回错误
const SUBAGENT_BLOCKED_TOOLS = new Set([
  'run_subagent', 'read_subagent', 'ask_user_question', 'request_scope',
  'deploy_web_app', 'read_deployment_config', 'check_deploy_status',
  'create_memory', 'mcp_list_servers', 'mcp_list_tools', 'mcp_call_tool',
  'mcp_read_resource', 'write_to_process', 'get_output', 'kill_shell',
]);
function filterTools(tools) {
  if (!Array.isArray(tools)) return [];
  return tools.filter(t => t && t.name && !SUBAGENT_BLOCKED_TOOLS.has(t.name));
}

function truncate(s, max = MAX_OUTPUT) {
  s = String(s ?? '');
  return s.length > max ? s.slice(0, max) + '\n...[truncated]' : s;
}
const isWindows = process.platform === 'win32';
function shellQuote(s) {
  s = String(s ?? '');
  if (s === '') return isWindows ? '""' : "''";
  if (isWindows) {
    // Windows: 用双引号包裹，内部双引号和反斜杠转义；安全字符直接用
    if (/^[a-zA-Z0-9_.\\\/+:@,=-]+$/.test(s)) return s;
    return '"' + s.replace(/(["\\])/g, '\\$1') + '"';
  }
  if (/^[a-zA-Z0-9_.\/+:@,=-]+$/.test(s)) return s;
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

// ===== 本地工具执行（Node 标准库）=====
// workspacePath: 从主 Agent system prompt 提取的项目根目录，作为工具的默认 cwd
async function executeTool(name, params, workspacePath) {
  try {
    switch (name) {
      case 'read': return await toolRead(params);
      case 'write': return await toolWrite(params);
      case 'edit': return await toolEdit(params);
      case 'multi_edit': return await toolMultiEdit(params);
      case 'grep': return await toolGrep(params, workspacePath);
      case 'find_file_by_name': return await toolFind(params, workspacePath);
      case 'list_dir': return await toolListDir(params);
      case 'exec': return await toolExec(params, workspacePath);
      case 'web_search': return await toolWebSearch(params);
      case 'webfetch': return await toolWebfetch(params);
      case 'todo_write': return 'OK';
      case 'notebook_read': return await toolNotebookRead(params);
      case 'notebook_edit': return await toolNotebookEdit(params);
      case 'skill': return await toolSkill(params);
      default: return `[tool ${name} not supported in byok subagent]`;
    }
  } catch (e) {
    return `error: ${e.message}`;
  }
}

async function toolRead(p) {
  const fp = p.file_path || p.path || p.target_file;
  if (!fp) return 'error: file_path required';
  const data = fs.readFileSync(fp, 'utf8');
  const lines = data.split('\n');
  return truncate(lines.map((l, i) => `${String(i + 1).padStart(6)}\t${l}`).join('\n'));
}

async function toolWrite(p) {
  const fp = p.file_path || p.path || p.TargetFile;
  if (!fp) return 'error: file_path required';
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, p.content || '', 'utf8');
  return `wrote ${fp}`;
}

async function toolEdit(p) {
  const fp = p.file_path || p.path;
  if (!fp) return 'error: file_path required';
  const oldStr = p.old_string;
  const newStr = p.new_string ?? '';
  if (oldStr === undefined) return 'error: old_string required';
  let content = fs.readFileSync(fp, 'utf8');
  if (!content.includes(oldStr)) return `error: old_string not found in ${fp}`;
  if (p.replace_all) {
    content = content.split(oldStr).join(newStr);
  } else {
    const idx = content.indexOf(oldStr);
    content = content.slice(0, idx) + newStr + content.slice(idx + oldStr.length);
  }
  fs.writeFileSync(fp, content, 'utf8');
  return `edited ${fp}`;
}

async function toolMultiEdit(p) {
  const fp = p.file_path || p.path;
  if (!fp) return 'error: file_path required';
  const edits = p.edits || [];
  if (!Array.isArray(edits) || edits.length === 0) return 'error: edits array required';
  let content = fs.readFileSync(fp, 'utf8');
  for (const e of edits) {
    if (e.old_string === undefined || !content.includes(e.old_string)) {
      return `error: old_string not found: ${String(e.old_string).slice(0, 60)}`;
    }
    const idx = content.indexOf(e.old_string);
    content = content.slice(0, idx) + (e.new_string ?? '') + content.slice(idx + e.old_string.length);
  }
  fs.writeFileSync(fp, content, 'utf8');
  return `multi-edited ${fp} (${edits.length} edits)`;
}

async function toolGrep(p, workspacePath) {
  const pattern = p.pattern || p.Query || p.query || p.search_term;
  if (!pattern) return 'error: pattern required';
  const searchPath = p.path || p.SearchPath || workspacePath || '.';
  const caseInsensitive = !!p.case_insensitive;
  const ctx = parseInt(p.context_lines || '0', 10);
  const maxR = parseInt(p.max_results || '100', 10);
  const glob = p.glob_pattern || '';
  // rg 命令优先级：DEVIN_BUNDLED_RG 绝对路径 > 系统 PATH 的 rg（Windows 加 .exe）
  const rgBase = process.env.DEVIN_BUNDLED_RG || 'rg';
  const rgBin = isWindows && !rgBase.endsWith('.exe') ? rgBase + '.exe' : rgBase;
  const args = ['--line-number', '-N', '--no-heading'];
  if (caseInsensitive) args.push('-i');
  if (ctx > 0) args.push('-C', String(ctx));
  args.push('-m', String(maxR));
  if (glob) args.push('-g', glob);
  args.push('--', pattern, searchPath);
  try {
    const { stdout } = await execAsync(shellQuote(rgBin) + ' ' + args.map(shellQuote).join(' '), { maxBuffer: 2 * 1024 * 1024 });
    return truncate(stdout) || '(no matches)';
  } catch (e) {
    if (e.code === 1) return '(no matches)';
    if (e.code === 127) {
      // rg 不可用，fallback 到 node 内置实现
      return await grepNodeFallback({ pattern, searchPath, caseInsensitive, ctx, maxR, glob });
    }
    return `error: ${e.message}`;
  }
}

// node 内置 grep fallback：递归遍历目录，正则匹配文件内容
async function grepNodeFallback({ pattern, searchPath, caseInsensitive, ctx, maxR, glob }) {
  let regex;
  try {
    regex = new RegExp(pattern, caseInsensitive ? 'i' : '');
  } catch (e) {
    return `error: invalid regex: ${e.message}`;
  }
  const results = [];
  const seenFiles = new Set();
  // glob 转 minimatch 风格的正则（简化版，支持 * ? 和 **）
  const globRegex = glob ? globToRegex(glob) : null;
  const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv', 'venv', '.cache']);
  function walk(dir, depth) {
    if (depth > 15 || results.length >= maxR * 4) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch { return; }
    for (const ent of entries) {
      if (results.length >= maxR * 4) return;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (skipDirs.has(ent.name)) continue;
        walk(full, depth + 1);
      } else if (ent.isFile()) {
        if (globRegex && !globRegex.test(ent.name) && !globRegex.test(full)) continue;
        if (seenFiles.has(full)) continue;
        seenFiles.add(full);
        try {
          const content = fs.readFileSync(full, 'utf8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              // 收集上下文
              const start = Math.max(0, i - ctx);
              const end = Math.min(lines.length - 1, i + ctx);
              for (let j = start; j <= end; j++) {
                const prefix = j === i ? ':' : '-';
                results.push(`${full}:${j + 1}${prefix} ${lines[j]}`);
              }
              if (ctx > 0) results.push(`${full}--`);
              if (results.length >= maxR * 4) return;
            }
          }
        } catch { /* 二进制/无权限，跳过 */ }
      }
    }
  }
  try {
    const st = fs.statSync(searchPath);
    if (st.isFile()) {
      const content = fs.readFileSync(searchPath, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          const start = Math.max(0, i - ctx);
          const end = Math.min(lines.length - 1, i + ctx);
          for (let j = start; j <= end; j++) {
            const prefix = j === i ? ':' : '-';
            results.push(`${searchPath}:${j + 1}${prefix} ${lines[j]}`);
          }
          if (ctx > 0) results.push(`${searchPath}--`);
          if (results.length >= maxR * 4) break;
        }
      }
    } else if (st.isDirectory()) {
      walk(searchPath, 0);
    }
  } catch (e) {
    return `error: ${e.message}`;
  }
  const out = results.slice(0, maxR).join('\n');
  return truncate(out) || '(no matches)';
}

function globToRegex(glob) {
  // 简化版 glob → regex，支持 * ? ** 和普通字符
  let s = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  s = s.replace(/\*\*/g, '\x00').replace(/\*/g, '[^/]*').replace(/\x00/g, '.*');
  s = s.replace(/\?/g, '[^/]');
  return new RegExp(s + '$');
}

async function toolFind(p, workspacePath) {
  const pattern = p.pattern || p.Pattern;
  if (!pattern) return 'error: pattern required';
  const dir = p.path || p.SearchDirectory || workspacePath || '.';
  // Windows 无 Unix find，用 Node 内置递归实现
  if (isWindows) {
    return findNodeFallback(pattern, dir);
  }
  try {
    const { stdout } = await execAsync(
      `find ${shellQuote(dir)} -name ${shellQuote(pattern)} -type f 2>/dev/null | head -100`,
      { maxBuffer: 1024 * 1024 }
    );
    return truncate(stdout) || '(no matches)';
  } catch (e) { return `error: ${e.message}`; }
}

// Node 内置 find fallback（Windows 用）
function findNodeFallback(pattern, dir) {
  const results = [];
  const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv', 'venv', '.cache']);
  function walk(d, depth) {
    if (depth > 15 || results.length >= 100) return;
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      if (results.length >= 100) return;
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (skipDirs.has(ent.name)) continue;
        walk(full, depth + 1);
      } else if (ent.isFile()) {
        // 简单 glob 匹配（支持 * 和 ?）
        if (simpleGlobMatch(pattern, ent.name)) results.push(full);
      }
    }
  }
  try {
    const st = fs.statSync(dir);
    if (st.isDirectory()) walk(dir, 0);
  } catch (e) { return `error: ${e.message}`; }
  return truncate(results.join('\n')) || '(no matches)';
}

function simpleGlobMatch(pattern, name) {
  // 把 glob 转 regex（支持 * 和 ?）
  let s = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  s = s.replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]');
  return new RegExp('^' + s + '$').test(name);
}

async function toolListDir(p) {
  const dir = p.directory_path || p.path || p.DirectoryPath || '.';
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.map(e => (e.isDirectory() ? e.name + '/' : e.name)).join('\n');
  } catch (e) { return `error: ${e.message}`; }
}

async function toolExec(p, workspacePath) {
  const cmd = p.command || p.CommandLine;
  if (!cmd) return 'error: command required';
  const cwd = p.cwd || p.Cwd || workspacePath || process.cwd();
  const timeout = parseInt(p.timeout || '30000', 10);
  // Windows 用 cmd.exe 执行，Unix 用默认 shell
  const shellOpt = isWindows ? 'cmd.exe' : undefined;
  const { stdout, stderr } = await execAsync(cmd, { cwd, timeout, maxBuffer: 2 * 1024 * 1024, shell: shellOpt });
  let out = '';
  if (stdout) out += stdout;
  if (stderr) out += (out ? '\n[stderr]\n' : '') + stderr;
  return truncate(out) || '(no output)';
}

async function toolWebSearch(p) {
  const query = p.query || p.q;
  if (!query) return 'error: query required';
  const results = await searchDuckDuckGo(query, p.num_results || 5);
  return truncate(results.map(r => `## ${r.title}\nURL: ${r.url}\n${r.snippet}`).join('\n\n'));
}

async function toolWebfetch(p) {
  const url = p.url;
  if (!url) return 'error: url required';
  if (!isAllowedUrl(url)) return 'error: url not allowed (localhost/private IP blocked)';
  return await new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch { return resolve('error: invalid url'); }
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.get({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        toolWebfetch({ url: new URL(res.headers.location, url).toString() }).then(resolve);
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', d => body += d);
      res.on('end', () => {
        const text = body
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ').trim();
        resolve(truncate(text));
      });
    });
    req.on('error', e => resolve(`error: ${e.message}`));
    req.setTimeout(15000, () => { req.destroy(); resolve('error: timeout'); });
  });
}

// ===== notebook 工具（.ipynb JSON 解析）=====
async function toolNotebookRead(p) {
  const fp = p.notebook_path || p.file_path || p.path;
  if (!fp) return 'error: notebook_path required';
  let data;
  try {
    data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    return `error: failed to parse .ipynb: ${e.message}`;
  }
  const cells = Array.isArray(data.cells) ? data.cells : [];
  const out = cells.map((c, i) => {
    const ct = c.cell_type || 'unknown';
    const src = Array.isArray(c.source) ? c.source.join('') : String(c.source || '');
    let s = `## [cell ${i}] ${ct}\n${src}`;
    if (Array.isArray(c.outputs) && c.outputs.length > 0) {
      s += '\n### outputs:';
      for (const o of c.outputs) {
        if (o.output_type === 'stream') {
          s += `\n[${o.name}] ${Array.isArray(o.text) ? o.text.join('') : o.text || ''}`;
        } else if (o.output_type === 'execute_result' || o.output_type === 'display_data') {
          const d = o.data || {};
          if (d['text/plain']) s += `\n[result] ${Array.isArray(d['text/plain']) ? d['text/plain'].join('') : d['text/plain']}`;
          else if (d['text/html']) s += `\n[result html] ${(Array.isArray(d['text/html']) ? d['text/html'].join('') : d['text/html']).slice(0, 200)}`;
        } else if (o.output_type === 'error') {
          s += `\n[error] ${o.ename}: ${o.evalue}`;
        }
      }
    }
    return s;
  });
  return truncate(out.join('\n\n')) || '(empty notebook)';
}

async function toolNotebookEdit(p) {
  const fp = p.notebook_path || p.file_path || p.path;
  if (!fp) return 'error: notebook_path required';
  let data;
  try {
    data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    return `error: failed to parse .ipynb: ${e.message}`;
  }
  const mode = p.edit_mode || 'replace';
  const cellNumber = parseInt(p.cell_number ?? '0', 10);
  const cellType = p.cell_type;
  const newSource = p.new_source;
  if (!Array.isArray(data.cells)) data.cells = [];
  if (mode === 'insert') {
    if (cellNumber < 0 || cellNumber > data.cells.length) return `error: cell_number out of range (0-${data.cells.length})`;
    data.cells.splice(cellNumber, 0, {
      cell_type: cellType || 'code',
      source: Array.isArray(newSource) ? newSource : String(newSource || '').split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l),
      metadata: {},
      outputs: cellType === 'code' ? [] : undefined,
      execution_count: cellType === 'code' ? null : undefined,
    });
  } else if (mode === 'delete') {
    if (cellNumber < 0 || cellNumber >= data.cells.length) return `error: cell_number out of range (0-${data.cells.length - 1})`;
    data.cells.splice(cellNumber, 1);
  } else {
    // replace
    if (cellNumber < 0 || cellNumber >= data.cells.length) return `error: cell_number out of range (0-${data.cells.length - 1})`;
    if (cellType) data.cells[cellNumber].cell_type = cellType;
    if (newSource !== undefined) {
      data.cells[cellNumber].source = Array.isArray(newSource) ? newSource : String(newSource);
    }
  }
  fs.writeFileSync(fp, JSON.stringify(data, null, 1) + '\n', 'utf8');
  return `notebook edited ${fp} (mode=${mode}, cell=${cellNumber})`;
}

// ===== skill 工具（仅 list 模式，读 .devin/skills/ 和 ~/.config/devin/skills/）=====
async function toolSkill(p) {
  const mode = p.command || p.mode || 'list';
  if (mode !== 'list' && mode !== 'search' && mode !== 'discover') {
    return 'error: only list/search/discover mode supported in byok subagent (invoke not supported)';
  }
  const homeDir = os.homedir();
  const skillRoots = [
    path.join(process.cwd(), '.devin', 'skills'),
    path.join(homeDir, '.config', 'devin', 'skills'),
    path.join(homeDir, '.codeium', 'windsurf', 'skills'),
  ];
  const skills = [];
  for (const root of skillRoots) {
    let entries;
    try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const skillMd = path.join(root, ent.name, 'SKILL.md');
      let title = ent.name;
      try {
        const md = fs.readFileSync(skillMd, 'utf8');
        const m = md.match(/^#\s+(.+)$/m);
        if (m) title = m[1].trim();
      } catch {}
      skills.push({ name: ent.name, title, path: path.join(root, ent.name) });
    }
  }
  if (skills.length === 0) return '(no skills found)';
  return skills.map(s => `## ${s.name}\n${s.title}\nPath: ${s.path}`).join('\n\n');
}

// ===== 非流式模型调用（复用 BYOK 配置）=====
function callAnthropicOnce({ systemPrompt, messages, tools, resolvedModel, byokSlot, thinkingOptions }) {
  return new Promise((resolve, reject) => {
    const cfg = getProviderConfig(byokSlot).anthropic;
    const body = {
      model: resolvedModel,
      system: systemPrompt || undefined,
      messages,
      max_tokens: 16384,
      stream: false,
    };
    if (Array.isArray(tools) && tools.length > 0) {
      body.tools = tools.map(t => ({
        name: t.name,
        description: t.description || '',
        input_schema: t.input_schema || { type: 'object', properties: {} },
      }));
    }
    if (thinkingOptions?.thinkingEnabled) {
      body.thinking = { type: 'enabled', budget_tokens: 10000 };
      body.max_tokens = Math.max(body.max_tokens, 12000);
    }
    const payload = JSON.stringify(body);
    const lib = cfg.useHttp ? http : https;
    const port = cfg.parsed.port !== 443 ? cfg.parsed.port : cfg.useHttp ? 80 : 443;
    const req = lib.request({
      hostname: cfg.parsed.hostname,
      port,
      path: cfg.apiPath,
      method: 'POST',
      rejectUnauthorized: !cfg.useHttp && cfg.parsed.port === 443,
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': cfg.apiKey,
        'content-length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', d => data += d);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Anthropic ${res.statusCode}: ${data.slice(0, 300)}`));
          return;
        }
        try {
          const j = JSON.parse(data);
          const textParts = (j.content || []).filter(c => c.type === 'text').map(c => c.text);
          const toolUses = (j.content || []).filter(c => c.type === 'tool_use').map(c => ({
            id: c.id, name: c.name, input: c.input,
          }));
          resolve({
            text: textParts.join(''),
            toolCalls: toolUses,
            stopReason: j.stop_reason || (toolUses.length > 0 ? 'tool_use' : 'stop'),
          });
        } catch (e) { reject(new Error('parse error: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(REQUEST_TIMEOUT, () => { req.destroy(); reject(new Error('timeout')); });
    req.end(payload);
  });
}

function callOpenAIOnce({ systemPrompt, messages, tools, resolvedModel, byokSlot, thinkingOptions }) {
  return new Promise((resolve, reject) => {
    const cfg = getProviderConfig(byokSlot).openai;
    const oaMessages = toChatCompletionsMessages(systemPrompt, messages);
    const body = {
      model: resolvedModel,
      messages: oaMessages,
      stream: false,
      max_tokens: 16384,
    };
    if (Array.isArray(tools) && tools.length > 0) {
      body.tools = tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description || '',
          parameters: t.input_schema || { type: 'object', properties: {} },
        },
      }));
    }
    // 仅 gpt 路径传 reasoning_effort；gemini 兼容网关可能不支持
    if (thinkingOptions?.provider === 'gpt' && thinkingOptions?.thinkingEnabled && thinkingOptions.reasoningEffort) {
      body.reasoning_effort = thinkingOptions.reasoningEffort;
    }
    const payload = JSON.stringify(body);
    const lib = cfg.useHttp ? http : https;
    const port = cfg.parsed.port !== 443 ? cfg.parsed.port : cfg.useHttp ? 80 : 443;
    const apiPath = toChatCompletionsPath(cfg.apiPath);
    const req = lib.request({
      hostname: cfg.parsed.hostname,
      port,
      path: apiPath,
      method: 'POST',
      rejectUnauthorized: !cfg.useHttp && cfg.parsed.port === 443,
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + cfg.apiKey,
        'content-length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', d => data += d);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`OpenAI ${res.statusCode}: ${data.slice(0, 300)}`));
          return;
        }
        try {
          const j = JSON.parse(data);
          const choice = j.choices?.[0];
          const msg = choice?.message || {};
          const toolCalls = (msg.tool_calls || []).map((tc, i) => {
            let input = {};
            try { input = JSON.parse(tc.function?.arguments || '{}'); } catch {}
            return { id: tc.id || `call_${i}`, name: tc.function?.name || '', input };
          });
          resolve({
            text: msg.content || '',
            toolCalls,
            stopReason: choice?.finish_reason || (toolCalls.length > 0 ? 'tool_calls' : 'stop'),
          });
        } catch (e) { reject(new Error('parse error: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(REQUEST_TIMEOUT, () => { req.destroy(); reject(new Error('timeout')); });
    req.end(payload);
  });
}

// ===== 子 Agent 主循环 =====
export async function runSubagent({ task, profile, tools, resolvedModel, byokSlot, thinkingOptions, workspacePath }) {
  let systemPrompt = getSubagentPrompt(profile);
  // 注入 workspace 路径，让子 Agent LLM 知道项目在哪，用绝对路径调工具
  if (workspacePath) {
    systemPrompt += `\n\nCurrent workspace: ${workspacePath}\nWhen using grep/find/exec with relative paths, they resolve to this workspace. Prefer absolute paths based on this workspace.`;
  }
  const subTools = filterTools(tools);
  const useOpenAi = thinkingOptions?.provider === 'gpt' || thinkingOptions?.provider === 'gemini';
  const callFn = useOpenAi ? callOpenAIOnce : callAnthropicOnce;
  const agentId = 'sub-' + Date.now() + '-' + Math.random().toString(16).slice(2, 8);

  let messages = [{ role: 'user', content: task || '(empty task)' }];
  console.log(`  🤖 [subagent] start profile=${profile} model=${resolvedModel} provider=${thinkingOptions?.provider || 'claude'} tools=${subTools.length}`);
  emitSubagentStart({
    agentId,
    profile,
    task: task || '',
    model: resolvedModel || '',
    provider: thinkingOptions?.provider || 'claude',
    toolCount: subTools.length
  });
  subagentStart({
    agentId,
    profile,
    task: task || '',
    model: resolvedModel || '',
    provider: thinkingOptions?.provider || 'claude',
    toolCount: subTools.length,
    ts: Date.now()
  });

  let lastTurn = -1;
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    lastTurn = turn;
    let result;
    try {
      result = await callFn({ systemPrompt, messages, tools: subTools, resolvedModel, byokSlot, thinkingOptions });
    } catch (e) {
      console.error(`  🤖 [subagent] model error turn=${turn}: ${e.message}`);
      emitSubagentEnd({ agentId, ok: false, summary: `[subagent error] ${e.message}`, turns: turn, reason: 'error' });
      subagentEnd({ agentId, ok: false, summary: `[subagent error] ${e.message}`, turns: turn, ts: Date.now() });
      return `[subagent error] ${e.message}`;
    }

    if (!result || result.toolCalls.length === 0) {
      console.log(`  🤖 [subagent] done turn=${turn} text=${(result?.text || '').length}b`);
      const summary = result?.text || '(subagent returned empty)';
      emitSubagentTurn({ agentId, turn, tools: [], text: summary });
      emitSubagentEnd({ agentId, ok: true, summary, turns: turn + 1, reason: 'done' });
      subagentTurn({ agentId, turn, ts: Date.now() });
      subagentEnd({ agentId, ok: true, summary, turns: turn + 1, ts: Date.now() });
      return summary;
    }

    console.log(`  🤖 [subagent] turn=${turn} tools=${result.toolCalls.map(t => t.name).join(',')}`);
    emitSubagentTurn({
      agentId,
      turn,
      tools: result.toolCalls.map(t => t.name),
      text: result.text || ''
    });
    subagentTurn({ agentId, turn, ts: Date.now() });

    // 构建 assistant 消息（Anthropic content blocks 格式，调 OpenAI 时 toChatCompletionsMessages 会转换）
    const assistantContent = [];
    if (result.text) assistantContent.push({ type: 'text', text: result.text });
    for (const tc of result.toolCalls) {
      assistantContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
    }
    messages.push({ role: 'assistant', content: assistantContent });

    // 执行工具
    const toolResults = [];
    for (const tc of result.toolCalls) {
      const argsStr = JSON.stringify(tc.input);
      console.log(`  🤖 [subagent] exec ${tc.name}: ${argsStr.slice(0, 100)}`);
      emitSubagentToolExec({ agentId, tool: tc.name, args: argsStr, callId: tc.id });
      const tr = await executeTool(tc.name, tc.input, workspacePath);
      emitSubagentToolResult({ agentId, callId: tc.id, tool: tc.name, result: tr, ok: !tr.startsWith('error:') });
      toolResults.push({ type: 'tool_result', tool_use_id: tc.id, content: tr });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  console.warn(`  🤖 [subagent] reached max turns ${MAX_TURNS}`);
  emitSubagentEnd({ agentId, ok: false, summary: `(subagent reached max turns ${MAX_TURNS})`, turns: lastTurn + 1, reason: 'max_turns' });
  subagentEnd({ agentId, ok: false, summary: `(subagent reached max turns ${MAX_TURNS})`, turns: lastTurn + 1, ts: Date.now() });
  return `(subagent reached max turns ${MAX_TURNS})`;
}

// 扫描 messages 找失败的 run_subagent（返回 toolUse/toolResult 引用，修改 toolResult.content 即生效）
export function findFailedSubagents(messages) {
  // 1. 收集所有 run_subagent tool_use
  const subagentUses = new Map();
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== 'assistant' || !Array.isArray(m.content)) continue;
    for (const b of m.content) {
      if (b && b.type === 'tool_use' && b.name === 'run_subagent' && b.id) {
        subagentUses.set(b.id, { toolUse: b, assistantMsgIndex: i });
      }
    }
  }
  if (subagentUses.size === 0) return [];
  // 2. 找对应的 tool_result，判断是否失败
  const result = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== 'user' || !Array.isArray(m.content)) continue;
    for (const b of m.content) {
      if (!b || b.type !== 'tool_result') continue;
      const use = subagentUses.get(b.tool_use_id);
      if (!use) continue;
      const content = typeof b.content === 'string' ? b.content : JSON.stringify(b.content);
      const isFail = b.is_error === true || /No subagent found|validation failed/i.test(content);
      if (isFail) {
        result.push({
          toolUse: use.toolUse,
          toolResult: b,
          assistantMsgIndex: use.assistantMsgIndex,
          resultMsgIndex: i,
        });
      }
    }
  }
  return result;
}
