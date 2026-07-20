/**
 * 模板加载器
 * 负责加载HTML模板文件并替换占位符
 */

const fs = require('fs');
const path = require('path');

/**
 * 模板缓存（提升性能）
 */
const templateCache = new Map();

/**
 * 加载模板文件
 * @param {string} templatePath - 相对于 templates/ 目录的路径
 * @returns {string} 模板内容
 */
function loadTemplate(templatePath) {
  // 开发模式下禁用缓存，方便调试
  const useCache = process.env.NODE_ENV === 'production';

  if (useCache && templateCache.has(templatePath)) {
    return templateCache.get(templatePath);
  }

  const fullPath = path.join(__dirname, templatePath);

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');

    if (useCache) {
      templateCache.set(templatePath, content);
    }

    return content;
  } catch (error) {
    throw new Error(`Failed to load template: ${templatePath}\n${error.message}`, { cause: error });
  }
}

/**
 * 替换模板中的占位符
 * @param {string} template - 模板内容
 * @param {Object} data - 数据对象
 * @returns {string} 替换后的内容
 */
function interpolate(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key in data) {
      return data[key];
    }
    // 保留未匹配的占位符（用于调试）
    return match;
  });
}

/**
 * 渲染模板
 * @param {string} templatePath - 模板路径
 * @param {Object} data - 数据对象
 * @returns {string} 渲染后的HTML
 */
function render(templatePath, data = {}) {
  const template = loadTemplate(templatePath);
  return interpolate(template, data);
}

/**
 * 渲染主模板（包含 partials）
 * @param {Object} data - 数据对象
 * @returns {string} 完整的HTML
 */
function renderSidebar(data) {
  // 先渲染所有 partials
  const configTab = render('partials/config-tab.html', data);
  const systemTab = render('partials/system-tab.html', data);
  const controlTab = render('partials/control-tab.html', data);

  // 将 partials 注入到主模板
  const sidebarData = {
    ...data,
    configTab,
    systemTab,
    controlTab,
  };

  return render('sidebar.html', sidebarData);
}

/**
 * 清除模板缓存（用于开发热重载）
 */
function clearCache() {
  templateCache.clear();
}

module.exports = {
  loadTemplate,
  interpolate,
  render,
  renderSidebar,
  clearCache,
};
