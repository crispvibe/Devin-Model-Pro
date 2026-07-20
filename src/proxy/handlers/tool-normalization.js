export const KNOWN_TOOL_NAMES = new Set(["read_file", "edit", "multi_edit", "write_to_file", "run_command", "grep_search", "find_by_name", "list_dir", "code_search", "command_status", "browser_preview", "todo_list", "ask_user_question", "deploy_web_app", "read_deployment_config", "check_deploy_status", "create_memory", "search_web", "read_url_content", "view_content_chunk", "skill", "edit_notebook", "read_notebook", "trajectory_search", "read_resource", "list_resources", "read_terminal", "do_not_call", "exec", "write", "read", "grep", "webfetch", "web_search", "todo_write", "run_subagent", "read_subagent", "request_scope", "write_to_process", "get_output", "kill_shell", "find_file_by_name", "notebook_edit", "notebook_read", "mcp_call_tool", "mcp_list_servers", "mcp_list_tools", "mcp_read_resource", "bash"]);
export const DEVIN_DESKTOP_TOOLS = new Set(["exec", "write", "read", "edit", "grep", "find_file_by_name", "notebook_read", "notebook_edit", "get_output", "kill_shell", "write_to_process", "run_subagent", "read_subagent", "todo_write", "mcp_list_servers", "mcp_list_tools", "mcp_call_tool", "mcp_read_resource", "web_search", "webfetch", "skill", "request_scope", "ask_user_question"]);
// Cascade 模式不做 Windsurf→Devin 工具名转译，保留 Windsurf 原生工具名回传给客户端
const PROXY_MODE = (process.env.PROXY_MODE || "devin").toLowerCase() === "cascade" ? "cascade" : "devin";
// Windsurf 原生工具名 + 常见别名，Cascade 模式下原样返回不转译
const CASCADE_PASSTHROUGH_TOOLS = new Set([
  "read_file", "edit", "multi_edit", "write_to_file", "run_command", "grep_search",
  "find_by_name", "list_dir", "code_search", "command_status", "browser_preview",
  "todo_list", "ask_user_question", "deploy_web_app", "read_deployment_config",
  "check_deploy_status", "create_memory", "search_web", "read_url_content",
  "view_content_chunk", "skill", "edit_notebook", "read_notebook", "trajectory_search",
  "read_resource", "list_resources", "read_terminal", "do_not_call",
  // Windsurf 工具别名（normalizeToolInvocation 映射表的 key）
  "view_file", "open_file", "readFile", "cat_file", "write_file", "create_file",
  "save_file", "writeFile", "edit_file", "replace_in_file", "find_file", "find_files",
  "search_files", "rg", "search_text", "search_code", "search_repo", "search_in_codebase",
  "run_terminal_command", "execute_command", "run_command_line", "shell_command",
  "update_todo_list", "todo_list_create", "create_todo_list", "update_todos", "manage_todos",
  "askUserQuestion", "ask_user", "ask_human", "ask_followup_question",
]);
const MCP_TOOL_NAME_RE = /^mcp\d+_/i;
export function isMcpToolName(name) {
  return MCP_TOOL_NAME_RE.test(String(name || "").trim());
}
export function isAllowedToolName(name) {
  const trimmed = String(name || "").trim();
  return KNOWN_TOOL_NAMES.has(trimmed) || isMcpToolName(trimmed);
}
export function normalizeToolInvocation(arg0, arg1) {
  let tmp2 = arg0;
  const tmp3 = normalizeToolArguments(arg1);
  // Cascade 模式：Windsurf 原生工具名原样返回，不做 Windsurf→Devin 转译
  if (PROXY_MODE === "cascade" && CASCADE_PASSTHROUGH_TOOLS.has(String(tmp2 || "").trim())) {
    return { toolName: String(tmp2 || "").trim(), params: tmp3 };
  }
  const tmp4 = {
    view_file: "read",
    open_file: "read",
    readFile: "read",
    read_file: "read",
    cat_file: "read",
    view_content_chunk: "read",
    write_to_file: "write",
    write_file: "write",
    create_file: "write",
    save_file: "write",
    writeFile: "write",
    multi_edit: "edit",
    edit_file: "edit",
    replace_in_file: "edit",
    find_by_name: "find_file_by_name",
    find_file: "find_file_by_name",
    find_files: "find_file_by_name",
    search_files: "find_file_by_name",
    grep_search: "grep",
    rg: "grep",
    search_text: "grep",
    code_search: "grep",
    search_code: "grep",
    search_repo: "grep",
    search_in_codebase: "grep",
    run_command: "exec",
    run_terminal_command: "exec",
    execute_command: "exec",
    run_command_line: "exec",
    shell_command: "exec",
    command_status: "get_output",
    read_terminal: "get_output",
    todo_list: "todo_write",
    update_todo_list: "todo_write",
    todo_list_create: "todo_write",
    create_todo_list: "todo_write",
    update_todos: "todo_write",
    manage_todos: "todo_write",
    askUserQuestion: "ask_user_question",
    ask_user: "ask_user_question",
    ask_human: "ask_user_question",
    ask_followup_question: "ask_user_question",
    search_web: "web_search",
    read_url_content: "webfetch",
    edit_notebook: "notebook_edit",
    read_notebook: "notebook_read",
    read_resource: "mcp_read_resource",
    list_resources: "mcp_list_tools"
  };
  if (DEVIN_DESKTOP_TOOLS.has(String(tmp2 || "").trim())) {
    return { toolName: String(tmp2 || "").trim(), params: tmp3 };
  }
  tmp2 = tmp4[tmp2] || tmp2;
  // 流式 tool_use 的 arguments 可能是被截断/非法的 JSON 字符串，normalizeToolArguments 会原样返回字符串。
  // 此时不能在字符串上做键重映射（remapKey 会抛 TypeError 并导致整个代理进程崩溃），直接返回。
  if (tmp3 === null || typeof tmp3 !== "object" || Array.isArray(tmp3)) {
    return {
      toolName: tmp2,
      params: tmp3
    };
  }
  if (tmp2 === "read_file") {
    remapKey(tmp3, "target_file", "file_path");
    remapKey(tmp3, "path", "file_path");
    remapKey(tmp3, "TargetFile", "file_path");
  }
  if (tmp2 === "list_dir") {
    remapKey(tmp3, "directory", "DirectoryPath");
    remapKey(tmp3, "path", "DirectoryPath");
  }
  if (tmp2 === "code_search") {
    remapKey(tmp3, "query", "search_term");
    remapKey(tmp3, "prompt", "search_term");
    remapKey(tmp3, "path", "search_folder_absolute_uri");
    remapKey(tmp3, "directory", "search_folder_absolute_uri");
    remapKey(tmp3, "SearchPath", "search_folder_absolute_uri");
  }
  if (tmp2 === "grep_search") {
    remapKey(tmp3, "path", "SearchPath");
    remapKey(tmp3, "directory", "SearchPath");
    remapKey(tmp3, "query", "Query");
    remapKey(tmp3, "pattern", "Query");
    remapArrayKey(tmp3, "include", "Includes");
    remapArrayKey(tmp3, "includes", "Includes");
  }
  if (tmp2 === "run_command") {
    remapKey(tmp3, "command", "CommandLine");
    remapKey(tmp3, "cmd", "CommandLine");
    remapKey(tmp3, "cwd", "Cwd");
    remapKey(tmp3, "working_directory", "Cwd");
    remapKey(tmp3, "blocking", "Blocking");
    remapKey(tmp3, "safe", "SafeToAutoRun");
  }
  if (tmp2 === "todo_list") {
    if (tmp3.items !== undefined && tmp3.todos === undefined) {
      const tmp0 = Array.isArray(tmp3.items) ? tmp3.items : String(tmp3.items).split(/[,，]/).map(arg02 => arg02.trim()).filter(Boolean);
      tmp3.todos = tmp0.map((arg02, arg12) => ({
        id: String(arg12 + 1),
        content: typeof arg02 === "string" ? arg02 : arg02.content || arg02.text || String(arg02),
        priority: "medium",
        status: "pending"
      }));
      delete tmp3.items;
    }
    if (tmp3.tasks !== undefined && tmp3.todos === undefined) {
      tmp3.todos = Array.isArray(tmp3.tasks) ? tmp3.tasks : [];
      delete tmp3.tasks;
    }
    if (Array.isArray(tmp3.todos)) {
      tmp3.todos = tmp3.todos.map((arg02, arg12) => {
        if (typeof arg02 === "string") {
          return {
            id: String(arg12 + 1),
            content: arg02,
            priority: "medium",
            status: "pending"
          };
        }
        if (typeof arg02 === "object" && arg02 !== null) {
          return {
            id: arg02.id || String(arg12 + 1),
            content: arg02.content || arg02.text || arg02.title || String(arg02),
            priority: arg02.priority || "medium",
            status: arg02.status || "pending"
          };
        }
        return {
          id: String(arg12 + 1),
          content: String(arg02),
          priority: "medium",
          status: "pending"
        };
      });
    }
    delete tmp3.operation;
  }
  if (tmp2 === "write_to_file") {
    remapKey(tmp3, "file_path", "TargetFile");
    remapKey(tmp3, "path", "TargetFile");
    remapKey(tmp3, "target_file", "TargetFile");
    remapKey(tmp3, "content", "CodeContent");
    remapKey(tmp3, "code", "CodeContent");
    remapKey(tmp3, "text", "CodeContent");
    if (tmp3.EmptyFile === undefined) {
      tmp3.EmptyFile = false;
    }
  }
  if (tmp2 === "ask_user_question") {
    remapKey(tmp3, "question_text", "question");
    remapKey(tmp3, "prompt", "question");
    remapKey(tmp3, "message", "question");
    remapKey(tmp3, "choices", "options");
    remapKey(tmp3, "allow_multiple", "allowMultiple");
    remapKey(tmp3, "multi", "allowMultiple");
    remapKey(tmp3, "multiple", "allowMultiple");
  }
  if (tmp2 === "edit") {
    remapKey(tmp3, "path", "file_path");
    remapKey(tmp3, "target_file", "file_path");
    remapKey(tmp3, "search", "old_string");
    remapKey(tmp3, "replace", "new_string");
    remapKey(tmp3, "description", "explanation");
  }
  if (tmp2 === "multi_edit") {
    remapKey(tmp3, "path", "file_path");
    remapKey(tmp3, "target_file", "file_path");
    remapKey(tmp3, "description", "explanation");
  }
  if (tmp2 === "find_by_name") {
    remapKey(tmp3, "path", "SearchDirectory");
    remapKey(tmp3, "directory", "SearchDirectory");
    remapKey(tmp3, "pattern", "Pattern");
    remapKey(tmp3, "type", "Type");
  }
  if (tmp2 === "browser_preview") {
    remapKey(tmp3, "title", "Name");
    remapKey(tmp3, "name", "Name");
    remapKey(tmp3, "url", "Url");
  }
  if (tmp2 === "search_web") {
    remapKey(tmp3, "q", "query");
    remapKey(tmp3, "term", "query");
    remapKey(tmp3, "site", "domain");
  }
  const tmp5 = normalizeToolParams(tmp2, tmp3);
  const tmp6 = {
    toolName: tmp2,
    params: tmp5
  };
  return tmp6;
}
export function normalizeToolArguments(arg0) {
  if (arg0 == null) {
    return {};
  }
  if (typeof arg0 === "string") {
    const tmp0 = arg0.trim();
    const tmp1 = tmp0.startsWith("{") && tmp0.endsWith("}") || tmp0.startsWith("[") && tmp0.endsWith("]");
    if (tmp1) {
      try {
        return normalizeToolArguments(JSON.parse(tmp0));
      } catch {
        return arg0;
      }
    }
    return arg0;
  }
  if (Array.isArray(arg0)) {
    return arg0.map(arg02 => normalizeToolArguments(arg02));
  }
  if (typeof arg0 === "object") {
    const tmp0 = {};
    for (const [tmp02, tmp1] of Object.entries(arg0)) {
      tmp0[tmp02] = normalizeToolArguments(tmp1);
    }
    return tmp0;
  }
  return arg0;
}
export function normalizeToolParams(arg0, arg1) {
  if (!arg1 || typeof arg1 !== "object" || Array.isArray(arg1)) {
    return arg1;
  }
  const tmp2 = {};
  for (const [tmp0, tmp1] of Object.entries(arg1)) {
    let tmp02 = tmp1;
    if (typeof tmp02 !== "string") {
      tmp2[tmp0] = normalizeToolArguments(tmp02);
      continue;
    }
    const tmp12 = tmp02.trim();
    if (tmp12 === "true") {
      tmp2[tmp0] = true;
      continue;
    }
    if (tmp12 === "false") {
      tmp2[tmp0] = false;
      continue;
    }
    if (tmp12.startsWith("[") && tmp12.endsWith("]") || tmp12.startsWith("{") && tmp12.endsWith("}")) {
      try {
        tmp2[tmp0] = normalizeToolArguments(JSON.parse(tmp12));
        continue;
      } catch {}
    }
    tmp2[tmp0] = tmp02;
  }
  if (arg0 === "ask_user_question" && tmp2.options !== undefined) {
    tmp2.options = normalizeAskUserOptions(tmp2.options);
    if (tmp2.allowMultiple === undefined) {
      tmp2.allowMultiple = false;
    }
  }
  return tmp2;
}
export function normalizeAskUserOptions(arg0) {
  if (Array.isArray(arg0)) {
    return arg0.map(arg02 => {
      if (typeof arg02 === "string") {
        const tmp0 = arg02.trim();
        if (!tmp0) {
          return null;
        }
        const tmp1 = {
          label: tmp0,
          description: tmp0
        };
        return tmp1;
      }
      if (arg02 && typeof arg02 === "object") {
        const tmp0 = String(arg02.label || arg02.name || arg02.title || "").trim();
        const tmp1 = String(arg02.description || arg02.detail || tmp0).trim();
        if (!tmp0) {
          return null;
        }
        return {
          label: tmp0,
          description: tmp1 || tmp0
        };
      }
      return null;
    }).filter(Boolean);
  }
  if (typeof arg0 === "string") {
    return arg0.split(/[|,，\n]/).map(arg02 => arg02.trim()).filter(Boolean).map(arg02 => ({
      label: arg02,
      description: arg02
    }));
  }
  return [];
}
function remapKey(arg0, arg1, arg2) {
  if (!arg0 || typeof arg0 !== "object" || Array.isArray(arg0)) {
    return;
  }
  if (arg0[arg1] !== undefined && arg0[arg2] === undefined) {
    arg0[arg2] = arg0[arg1];
    delete arg0[arg1];
  }
}
function remapArrayKey(arg0, arg1, arg2) {
  if (!arg0 || typeof arg0 !== "object" || Array.isArray(arg0)) {
    return;
  }
  if (arg0[arg1] !== undefined && arg0[arg2] === undefined) {
    arg0[arg2] = Array.isArray(arg0[arg1]) ? arg0[arg1] : [arg0[arg1]];
    delete arg0[arg1];
  }
}
