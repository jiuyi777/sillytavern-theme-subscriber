const EXTENSION_KEY = 'theme_subscriber';
const PANEL_ID = 'theme-subscriber-panel';
const PENDING_THEME_KEY = 'theme-subscriber:pending-theme';
const RECOVERY_MENU_CONTAINER_ID = 'theme-subscriber-recovery-wand-container';
const RECOVERY_MENU_ITEM_ID = 'theme-subscriber-recovery-wand-item';
const RECOVERY_SHORTCUT_KEY = 'r';
const DEFAULT_FEEDBACK_ENDPOINT = 'https://jiuyi-theme-feedback.netlify.app/api/feedback';
const LEGACY_CATALOG_URL = 'https://raw.githubusercontent.com/jiuyi777/sillytavern-theme-assets/main/themes/catalog.json';
const RAW_CATALOG_URL = 'https://raw.githubusercontent.com/jiuyi777/sillytavern-theme-assets/main/assets/%E5%9C%A8%E7%BA%BF%E4%B8%BB%E9%A2%98%E5%BA%93/catalog.json';
const PREVIOUS_CATALOG_URL = 'https://raw.githubusercontent.com/jiuyi777/sillytavern-theme-assets/e8f96b7ab7795e1a731c6775a68c9fe82edda135/assets/%E5%9C%A8%E7%BA%BF%E4%B8%BB%E9%A2%98%E5%BA%93/catalog.json';
const PINNED_CATALOG_URL = 'https://raw.githubusercontent.com/jiuyi777/sillytavern-theme-assets/0f5107ad7851b767197eeb65ccf8a219350ac5da/assets/%E5%9C%A8%E7%BA%BF%E4%B8%BB%E9%A2%98%E5%BA%93/catalog.json';
const API_CATALOG_URL = 'https://api.github.com/repos/jiuyi777/sillytavern-theme-assets/contents/assets/%E5%9C%A8%E7%BA%BF%E4%B8%BB%E9%A2%98%E5%BA%93/catalog.json?ref=main';
const DEFAULT_CATALOG_URL = RAW_CATALOG_URL;
const LOCAL_THEME_LIBRARY_KEY = 'theme-subscriber:local-theme-library:v1';
const MAX_LOCAL_THEME_COUNT = 24;
const MAX_CATALOG_BYTES = 2 * 1024 * 1024;
const MAX_CATALOG_RESPONSE_BYTES = Math.ceil(MAX_CATALOG_BYTES * 4 / 3) + 64 * 1024;
const MAX_THEME_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 60000;
const FETCH_ATTEMPTS = 2;
const THEME_KEYS = Object.freeze([
    'name',
    'blur_strength',
    'main_text_color',
    'italics_text_color',
    'underline_text_color',
    'quote_text_color',
    'blur_tint_color',
    'chat_tint_color',
    'user_mes_blur_tint_color',
    'bot_mes_blur_tint_color',
    'shadow_color',
    'shadow_width',
    'border_color',
    'font_scale',
    'fast_ui_mode',
    'waifuMode',
    'avatar_style',
    'chat_display',
    'toastr_position',
    'noShadows',
    'chat_width',
    'timer_enabled',
    'timestamps_enabled',
    'timestamp_model_icon',
    'mesIDDisplay_enabled',
    'hideChatAvatars_enabled',
    'message_token_count_enabled',
    'expand_message_actions',
    'enableZenSliders',
    'enableLabMode',
    'hotswap_enabled',
    'custom_css',
    'bogus_folders',
    'zoomed_avatar_magnification',
    'reduced_motion',
    'compact_input_area',
    'show_swipe_num_all_messages',
    'click_to_edit',
    'media_display',
]);
const TRUSTED_HOSTS = new Set([
    'raw.githubusercontent.com',
    'github.com',
    'api.github.com',
    'cdn.jsdelivr.net',
]);
const CSS_QUICK_TIPS = Object.freeze([
    {
        id: 'global-font',
        title: '替换全局字体',
        description: '修改主要界面、聊天正文和输入文字的字体，并保留中文系统回退。',
        impact: '影响：主要文字；不会自动覆盖图标字体。',
        caution: '提醒：不要使用全局 * 强制字体，避免Font Awesome图标变成方框。',
        code: `:root {
  --my-theme-font: "Noto Serif SC", "Microsoft YaHei", sans-serif;
}

body,
#chat .mes_text,
#send_textarea {
  font-family: var(--my-theme-font);
}`,
    },
    {
        id: 'chat-text',
        title: '调整聊天正文',
        description: '修改正文大小、行距、字距和文字颜色。',
        impact: '影响：User与Character消息正文。',
        caution: '提醒：需要同时查看长正文、列表、引用、代码块和手机宽度。',
        code: `#chat .mes_text {
  font-size: 1rem;
  line-height: 1.85;
  letter-spacing: 0.02em;
  color: var(--SmartThemeBodyColor);
}`,
    },
    {
        id: 'theme-colors',
        title: '建立主题配色',
        description: '先建立统一颜色变量，再让不同窗口复用。',
        impact: '影响：背景、正文、强调、边框和焦点状态。',
        caution: '提醒：颜色只是示例；正式主题应换成参考图或批准色卡。',
        code: `:root {
  --my-page: #f5efe4;
  --my-surface: #fffaf1;
  --my-text: #352b25;
  --my-accent: #9b5f55;
  --my-border: #c9a99b;
  --my-focus: #7e4f88;
}`,
    },
    {
        id: 'message-card',
        title: '修改消息卡片',
        description: '给每条消息增加主题背景、边框和圆角。',
        impact: '影响：聊天区每条真实消息外壳。',
        caution: '提醒：不要写固定高度，也不要用正文负边距修头像槽。',
        code: `#chat .mes {
  background: var(--my-surface);
  border: 1px solid var(--my-border);
  border-radius: 1rem;
}`,
    },
    {
        id: 'input-area',
        title: '修改输入区域',
        description: '统一输入框外壳、文字、边框和圆角。',
        impact: '影响：输入文字、多行输入和底部输入外壳。',
        caution: '提醒：使用min-height，不要让固定高度裁掉发送或停止按钮。',
        code: `#send_form {
  background: var(--my-surface);
  border: 1px solid var(--my-border);
  border-radius: 1rem;
}

#send_textarea {
  min-height: 2.75rem;
  color: var(--my-text);
  background: transparent;
}`,
    },
    {
        id: 'button-states',
        title: '修改按钮状态',
        description: '处理普通、悬停、按下、焦点和禁用状态。',
        impact: '影响：通用菜单按钮及使用相同宿主的操作键。',
        caution: '提醒：焦点环不能删除；开关开/关仍需按真实节点单独处理。',
        code: `.menu_button {
  color: var(--my-text);
  background: var(--my-surface);
  border-color: var(--my-border);
  filter: none;
  opacity: 1;
}

.menu_button:hover,
.menu_button:active {
  color: var(--my-accent);
  border-color: var(--my-accent);
}

.menu_button:focus-visible {
  outline: 2px solid var(--my-focus);
  outline-offset: 2px;
}

.menu_button:disabled {
  opacity: 0.55;
}`,
    },
    {
        id: 'mobile-reading-axis',
        title: '手机正文居中',
        description: '在消息父级已经释放头像侧槽后，用对称逻辑属性居中正文。',
        impact: '影响：窄屏User短消息与Character长正文。',
        caution: '提醒：不能只写margin-right或padding-right清零；必须先核对消息父级。',
        code: `@media (max-width: 600px) {
  #chat .mes_block {
    inline-size: 100%;
    min-inline-size: 0;
  }

  #chat .mes_text {
    max-inline-size: 42rem;
    margin-inline: auto;
    padding-inline: 1rem;
  }
}`,
    },
]);

const ctx = SillyTavern.getContext();
const eventTypes = ctx.eventTypes || ctx.event_types;
let feedbackThemeNames = [];
let previewGalleryEntries = [];
let previewGalleryIndex = -1;
let previewReturnFocus = null;

const DEFAULT_SETTINGS = Object.freeze({
    catalogUrl: DEFAULT_CATALOG_URL,
    installed: {},
    lastCheckedAt: '',
    previousTheme: '',
    lastBrokenTheme: '',
    recoveryEnabled: false,
    feedbackEndpoint: DEFAULT_FEEDBACK_ENDPOINT,
});

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function getSettings() {
    if (!ctx.extensionSettings[EXTENSION_KEY]) {
        ctx.extensionSettings[EXTENSION_KEY] = clone(DEFAULT_SETTINGS);
    }

    const settings = ctx.extensionSettings[EXTENSION_KEY];
    if (typeof settings.catalogUrl !== 'string'
        || !settings.catalogUrl.trim()
        || settings.catalogUrl === LEGACY_CATALOG_URL
        || settings.catalogUrl === API_CATALOG_URL
        || settings.catalogUrl === PREVIOUS_CATALOG_URL
        || settings.catalogUrl === PINNED_CATALOG_URL) {
        settings.catalogUrl = DEFAULT_CATALOG_URL;
    }
    if (!settings.installed || typeof settings.installed !== 'object' || Array.isArray(settings.installed)) {
        settings.installed = {};
    }
    if (typeof settings.lastCheckedAt !== 'string') {
        settings.lastCheckedAt = '';
    }
    if (typeof settings.previousTheme !== 'string') {
        settings.previousTheme = '';
    }
    if (typeof settings.lastBrokenTheme !== 'string') {
        settings.lastBrokenTheme = '';
    }
    if (typeof settings.recoveryEnabled !== 'boolean') {
        settings.recoveryEnabled = false;
    }
    if (typeof settings.feedbackEndpoint !== 'string' || !settings.feedbackEndpoint.trim()) {
        settings.feedbackEndpoint = DEFAULT_FEEDBACK_ENDPOINT;
    }
    return settings;
}

function notify(kind, message, title = '酒疫主题器') {
    const handler = window.toastr?.[kind];
    if (typeof handler === 'function') {
        handler(message, title);
    } else {
        console[kind === 'error' ? 'error' : 'log'](`[${title}] ${message}`);
    }
}

async function copyCssTip(text) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const fallback = document.createElement('textarea');
    fallback.value = text;
    fallback.setAttribute('readonly', '');
    fallback.style.position = 'fixed';
    fallback.style.inset = '-9999px auto auto -9999px';
    document.body.append(fallback);
    fallback.select();
    try {
        if (!document.execCommand('copy')) throw new Error('当前环境不允许复制');
    } finally {
        fallback.remove();
    }
}

function createCssQuickHelper() {
    const helper = document.createElement('details');
    helper.className = 'theme-subscriber-css-helper';

    const summary = document.createElement('summary');
    summary.textContent = 'CSS快捷修改提醒';

    const intro = document.createElement('p');
    intro.className = 'theme-subscriber-css-helper-intro';
    intro.textContent = '选择一项查看“改什么、影响哪里、注意什么”，再复制代码。代码不会自动应用到当前主题。';

    const list = document.createElement('div');
    list.className = 'theme-subscriber-css-tip-list';

    const status = document.createElement('p');
    status.className = 'theme-subscriber-css-copy-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = '复制后请先换成当前主题的颜色、字体和真实节点。';

    for (const tip of CSS_QUICK_TIPS) {
        const item = document.createElement('details');
        item.className = 'theme-subscriber-css-tip';

        const itemSummary = document.createElement('summary');
        const title = document.createElement('span');
        title.className = 'theme-subscriber-css-tip-title';
        title.textContent = tip.title;
        const description = document.createElement('small');
        description.textContent = tip.description;
        itemSummary.append(title, description);

        const body = document.createElement('div');
        body.className = 'theme-subscriber-css-tip-body';
        const impact = document.createElement('p');
        impact.textContent = tip.impact;
        const caution = document.createElement('p');
        caution.className = 'theme-subscriber-css-tip-caution';
        caution.textContent = tip.caution;
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = tip.code;
        pre.append(code);
        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.className = 'menu_button theme-subscriber-css-copy';
        copyButton.textContent = '复制代码';
        copyButton.addEventListener('click', async () => {
            copyButton.disabled = true;
            copyButton.textContent = '复制中…';
            try {
                await copyCssTip(tip.code);
                copyButton.textContent = '已复制';
                status.dataset.state = 'success';
                status.textContent = `已复制“${tip.title}”。代码不会自动应用，请先确认真实节点。`;
                window.setTimeout(() => {
                    copyButton.disabled = false;
                    copyButton.textContent = '复制代码';
                }, 1400);
            } catch (error) {
                copyButton.disabled = false;
                copyButton.textContent = '重新复制';
                status.dataset.state = 'error';
                status.textContent = `复制失败：${error?.message || '请手动选择代码'}。`;
            }
        });
        body.append(impact, caution, pre, copyButton);
        item.append(itemSummary, body);
        list.append(item);
    }

    helper.append(summary, intro, list, status);
    return helper;
}

function updateFeedbackThemeOptions(query = '') {
    const select = document.getElementById('theme-subscriber-feedback-theme');
    if (!(select instanceof HTMLSelectElement)) {
        return;
    }
    const previous = select.value;
    const normalizedQuery = String(query || '').trim().toLocaleLowerCase('zh-CN');
    const names = feedbackThemeNames.filter(name => !normalizedQuery || name.toLocaleLowerCase('zh-CN').includes(normalizedQuery));
    select.replaceChildren();
    const general = document.createElement('option');
    general.value = '酒疫主题器（通用功能）';
    general.textContent = '酒疫主题器（通用功能）';
    select.append(general);
    for (const name of names) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.append(option);
    }
    if (Array.from(select.options).some(option => option.value === previous)) {
        select.value = previous;
    }
}

function setFeedbackThemes(themes) {
    feedbackThemeNames = [...new Set(themes.map(theme => theme.displayName).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const search = document.getElementById('theme-subscriber-feedback-search');
    updateFeedbackThemeOptions(search instanceof HTMLInputElement ? search.value : '');
}

async function submitPlayerFeedback() {
    const theme = document.getElementById('theme-subscriber-feedback-theme');
    const type = document.getElementById('theme-subscriber-feedback-type');
    const device = document.getElementById('theme-subscriber-feedback-device');
    const message = document.getElementById('theme-subscriber-feedback-message');
    const submit = document.getElementById('theme-subscriber-feedback-submit');
    const status = document.getElementById('theme-subscriber-feedback-status');
    if (!(theme instanceof HTMLSelectElement)
        || !(type instanceof HTMLSelectElement)
        || !(device instanceof HTMLInputElement)
        || !(message instanceof HTMLTextAreaElement)) {
        return;
    }
    const feedback = message.value.trim();
    if (!feedback) {
        notify('warning', '请先填写希望增加的功能或需要反馈的问题。');
        message.focus();
        return;
    }
    if (!(submit instanceof HTMLButtonElement) || !(status instanceof HTMLElement)) return;
    const endpoint = getSettings().feedbackEndpoint.trim();
    if (!isTrustedFeedbackUrl(endpoint)) {
        status.dataset.state = 'error';
        status.textContent = '反馈服务尚未完成安全连接，请稍后更新酒疫主题器。';
        notify('error', status.textContent);
        return;
    }
    const originalLabel = submit.textContent;
    submit.disabled = true;
    submit.textContent = '正在发送…';
    status.dataset.state = 'loading';
    status.textContent = '正在酒馆内发送，不会打开其他页面。';
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                theme: theme.value,
                type: type.value,
                message: feedback,
                device: device.value.trim(),
                source: '酒疫主题器',
            }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result?.message || `反馈服务返回 ${response.status}`);
        message.value = '';
        status.dataset.state = 'success';
        status.textContent = result?.issueNumber
            ? `发送成功，已进入 GitHub 反馈 #${result.issueNumber}。`
            : '发送成功，已经进入 GitHub 反馈列表。';
        notify('success', status.textContent);
    } catch (error) {
        status.dataset.state = 'error';
        status.textContent = `发送失败：${error?.message || '反馈服务暂时不可用'}。内容仍保留在输入框中。`;
        notify('error', status.textContent);
    } finally {
        submit.disabled = false;
        submit.textContent = originalLabel;
    }
}

function isTrustedFeedbackUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:'
            && !url.username
            && !url.password
            && url.hostname === 'jiuyi-theme-feedback.netlify.app'
            && url.pathname === '/api/feedback';
    } catch {
        return false;
    }
}

function isTrustedUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:'
            && !url.username
            && !url.password
            && (TRUSTED_HOSTS.has(url.hostname) || url.hostname.endsWith('.github.io'));
    } catch {
        return false;
    }
}

function requireTrustedUrl(value, label) {
    if (!isTrustedUrl(value)) {
        throw new Error(`${label}必须是受信任的 GitHub 或 jsDelivr HTTPS 地址。`);
    }
    return new URL(value).toString();
}

async function fetchResource(url, maxBytes, label) {
    const safeUrl = requireTrustedUrl(url, label);
    const parsedUrl = new URL(safeUrl);
    const candidates = [safeUrl];
    if (parsedUrl.hostname === 'raw.githubusercontent.com') {
        const parts = parsedUrl.pathname.split('/').filter(Boolean);
        if (parts.length >= 4) {
            const [owner, repository, ref, ...fileParts] = parts;
            candidates.push(`https://cdn.jsdelivr.net/gh/${owner}/${repository}@${ref}/${fileParts.join('/')}`);
        }
    }

    let lastError;
    for (const candidate of [...new Set(candidates)]) {
        for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
            try {
                const response = await fetch(candidate, {
                    method: 'GET',
                    credentials: 'omit',
                    cache: 'no-store',
                    redirect: 'follow',
                    signal: controller.signal,
                    headers: { Accept: 'application/json,text/plain;q=0.9' },
                });

                if (!response.ok) {
                    throw new Error(`${label}请求失败：HTTP ${response.status}`);
                }
                requireTrustedUrl(response.url, `${label}重定向地址`);

                const length = Number(response.headers.get('content-length') || 0);
                if (length > maxBytes) {
                    throw new Error(`${label}超过允许大小。`);
                }

                const bytes = new Uint8Array(await response.arrayBuffer());
                if (bytes.byteLength > maxBytes) {
                    throw new Error(`${label}超过允许大小。`);
                }
                let text;
                try {
                    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
                } catch {
                    throw new Error(`${label}不是有效 UTF-8 文本。`);
                }
                return { text, bytes };
            } catch (error) {
                lastError = error?.name === 'AbortError' ? new Error(`${label}请求超时。`) : error;
                if (attempt < FETCH_ATTEMPTS) {
                    await new Promise(resolve => setTimeout(resolve, 500 * attempt));
                }
            } finally {
                clearTimeout(timer);
            }
        }
    }
    throw lastError || new Error(`${label}请求失败。`);
}

function parseJson(text, label) {
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`${label}不是有效 JSON。`);
    }
}

function decodeBase64Utf8(value, label) {
    const clean = String(value || '').replace(/\s/g, '');
    if (!clean || clean.length > Math.ceil(MAX_CATALOG_BYTES * 4 / 3) + 16) {
        throw new Error(`${label}内容为空或超过允许大小。`);
    }
    try {
        const binary = atob(clean);
        const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
        if (bytes.byteLength > MAX_CATALOG_BYTES) {
            throw new Error(`${label}超过允许大小。`);
        }
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (error) {
        if (error?.message === `${label}超过允许大小。`) {
            throw error;
        }
        throw new Error(`${label}不是有效的 Base64 UTF-8 内容。`);
    }
}

async function fetchCatalogText(url) {
    const resource = await fetchResource(url, MAX_CATALOG_RESPONSE_BYTES, '主题目录');
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== 'api.github.com') {
        return resource.text;
    }

    const envelope = parseJson(resource.text, 'GitHub 主题目录响应');
    if (envelope?.encoding !== 'base64' || typeof envelope.content !== 'string') {
        throw new Error('GitHub 主题目录响应缺少 Base64 文件内容。');
    }
    return decodeBase64Utf8(envelope.content, 'GitHub 主题目录');
}

function normalizeThemeVersion(versionEntry, theme, versionIndex, schemaVersion) {
    if (!versionEntry || typeof versionEntry !== 'object' || Array.isArray(versionEntry)) {
        throw new Error(`主题“${theme.name}”的第 ${versionIndex + 1} 个版本格式无效。`);
    }

    const version = String(versionEntry.version || '').trim();
    const themeUrl = requireTrustedUrl(versionEntry.theme_url, `主题“${theme.name}”v${version || versionIndex + 1} 地址`);

    if (!version || version.length > 40) {
        throw new Error(`主题“${theme.name}”的版本无效。`);
    }

    const approved = schemaVersion >= 3
        ? versionEntry.approved === true
        : schemaVersion === 1 || String(versionEntry.status || '').trim() === 'complete';

    return {
        id: theme.id,
        name: theme.name,
        themeName: String(versionEntry.theme_name || theme.name).trim().slice(0, 128),
        version,
        versionName: String(versionEntry.version_name || `v${version}`).trim().slice(0, 80),
        changelog: String(versionEntry.changelog || '暂无更新说明。').trim().slice(0, 300),
        themeUrl,
        description: theme.description,
        previewUrl: theme.previewUrl,
        minimumClientVersion: String(versionEntry.minimum_client_version || '').trim().slice(0, 40),
        updatedAt: String(versionEntry.updated_at || '').trim().slice(0, 80),
        status: String(versionEntry.status || '').trim().slice(0, 40),
        approved,
    };
}

function normalizeThemeEntry(entry, index, schemaVersion) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new Error(`目录中的第 ${index + 1} 个主题格式无效。`);
    }

    const id = String(entry.id || '').trim();
    const name = String(entry.name || '').trim();

    if (!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(id)) {
        throw new Error(`主题“${name || index + 1}”的 id 无效。`);
    }
    if (!name || name.length > 128) {
        throw new Error(`主题 ${id} 的名称无效。`);
    }
    const theme = {
        id,
        name,
        displayName: String(entry.display_name || name).trim().slice(0, 128),
        appearance: entry.appearance === 'light' ? 'light' : 'dark',
        description: String(entry.description || '').trim().slice(0, 500),
        logoUrl: entry.logo_url ? requireTrustedUrl(entry.logo_url, `主题“${name}”标识地址`) : '',
        logoAlt: String(entry.logo_alt || `${name}主题标识`).trim().slice(0, 160),
        previewUrl: entry.preview_url ? requireTrustedUrl(entry.preview_url, `主题“${name}”预览地址`) : '',
    };

    const rawVersions = schemaVersion === 1 ? [entry] : entry.versions;
    if (!Array.isArray(rawVersions) || rawVersions.length === 0 || rawVersions.length > 100) {
        throw new Error(`主题“${name}”缺少有效版本列表。`);
    }
    const versions = rawVersions.map((versionEntry, versionIndex) => normalizeThemeVersion(versionEntry, theme, versionIndex, schemaVersion));
    if (new Set(versions.map(item => item.version)).size !== versions.length) {
        throw new Error(`主题“${name}”包含重复版本号。`);
    }
    const latestVersion = schemaVersion === 1
        ? versions[0].version
        : String(entry.latest_version || versions[0].version).trim();
    const latestIndex = versions.findIndex(item => item.version === latestVersion);
    if (latestIndex < 0) {
        throw new Error(`主题“${name}”的 latest_version 不在版本列表中。`);
    }
    const approvedVersions = versions.filter(item => item.approved);
    const defaultVersion = schemaVersion === 1
        ? latestVersion
        : String(entry.default_version || approvedVersions[0]?.version || '').trim();
    if (defaultVersion) {
        const defaultIndex = versions.findIndex(item => item.version === defaultVersion);
        if (defaultIndex < 0) {
            throw new Error(`主题“${name}”的 default_version 不在版本列表中。`);
        }
        if (schemaVersion >= 3 && !versions[defaultIndex].approved) {
            throw new Error(`主题“${name}”的 default_version 必须指向已批准版本。`);
        }
        const [defaultEntry] = versions.splice(defaultIndex, 1);
        versions.unshift(defaultEntry);
    }

    return { ...theme, latestVersion, defaultVersion, versions };
}

function validateCatalog(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('主题目录根节点必须是对象。');
    }
    if (![1, 2, 3].includes(value.schema_version)) {
        throw new Error(`不支持的目录版本：${String(value.schema_version)}`);
    }
    if (!Array.isArray(value.themes)) {
        throw new Error('主题目录缺少 themes 数组。');
    }
    if (value.themes.length > 200) {
        throw new Error('主题目录项目过多。');
    }

    const themes = value.themes.map((entry, index) => normalizeThemeEntry(entry, index, value.schema_version));
    if (new Set(themes.map(theme => theme.id)).size !== themes.length) {
        throw new Error('主题目录包含重复 id。');
    }

    return {
        name: String(value.name || 'GitHub 主题库').trim().slice(0, 120),
        updatedAt: String(value.updated_at || '').trim().slice(0, 80),
        themes,
    };
}

function validateTheme(theme, expectedName = '') {
    if (!theme || typeof theme !== 'object' || Array.isArray(theme)) {
        throw new Error('主题文件根节点必须是对象。');
    }
    if (typeof theme.name !== 'string' || !theme.name.trim() || theme.name.length > 128) {
        throw new Error('主题文件缺少有效 name。');
    }
    if (expectedName && theme.name !== expectedName) {
        throw new Error(`目录名称“${expectedName}”与主题文件名称“${theme.name}”不一致。`);
    }
    if (typeof theme.custom_css !== 'string') {
        throw new Error('主题文件缺少 custom_css 字符串。');
    }
    const sanitized = {};
    for (const key of THEME_KEYS) {
        if (Object.hasOwn(theme, key)) {
            sanitized[key] = theme[key];
        }
    }
    return sanitized;
}

function getThemeWarnings(theme) {
    const warnings = [];
    if (theme.custom_css.includes('@import')) {
        warnings.push('主题 CSS 含有 @import，会继续加载外部资源。');
    }
    if (/url\s*\(\s*['"]?https?:/i.test(theme.custom_css)) {
        warnings.push('主题 CSS 含有远程图片或字体地址。');
    }
    return warnings;
}

function getLocalThemeStorage() {
    const storage = SillyTavern.libs?.localforage;
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
        throw new Error('当前酒馆不支持主题器本地收藏存储。');
    }
    return storage;
}

function createLocalThemeId() {
    return globalThis.crypto?.randomUUID?.()
        || `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeLocalThemeRecord(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
        throw new Error('本地主题记录格式无效。');
    }
    const theme = validateTheme(record.theme);
    return {
        id: String(record.id || createLocalThemeId()).slice(0, 120),
        name: theme.name,
        fileName: String(record.fileName || `${theme.name}.json`).slice(0, 180),
        importedAt: String(record.importedAt || '').slice(0, 80),
        bytes: Number.isFinite(Number(record.bytes)) ? Math.max(0, Number(record.bytes)) : 0,
        warnings: Array.isArray(record.warnings)
            ? record.warnings.map(item => String(item)).slice(0, 8)
            : getThemeWarnings(theme),
        theme,
    };
}

async function loadLocalThemeRecords() {
    const stored = await getLocalThemeStorage().getItem(LOCAL_THEME_LIBRARY_KEY);
    if (!Array.isArray(stored)) {
        return [];
    }
    const records = [];
    for (const item of stored.slice(0, MAX_LOCAL_THEME_COUNT)) {
        try {
            records.push(normalizeLocalThemeRecord(item));
        } catch (error) {
            console.warn('[酒疫主题器] 已忽略损坏的本地主题收藏记录。', error);
        }
    }
    return records;
}

async function saveLocalThemeRecords(records) {
    if (!Array.isArray(records) || records.length > MAX_LOCAL_THEME_COUNT) {
        throw new Error(`本地主题收藏最多保留 ${MAX_LOCAL_THEME_COUNT} 个文件。`);
    }
    await getLocalThemeStorage().setItem(LOCAL_THEME_LIBRARY_KEY, records);
}

function formatLocalThemeSize(bytes) {
    if (!bytes) return '未知大小';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ensureThemeOption(name) {
    const select = document.getElementById('themes');
    if (!(select instanceof HTMLSelectElement)) {
        return false;
    }
    if (!Array.from(select.options).some(option => option.value === name)) {
        select.append(new Option(name, name));
    }
    return true;
}

async function installLocalThemeRecord(record, button) {
    button.disabled = true;
    button.textContent = '正在加入…';
    try {
        const theme = validateTheme(record.theme);
        await saveTheme(theme);
        ensureThemeOption(theme.name);
        notify('success', `“${theme.name}”已加入酒馆主题列表，但没有启用。`);
        const status = document.getElementById('theme-subscriber-local-status');
        if (status) {
            status.textContent = `“${theme.name}”已加入酒馆主题列表；当前主题没有改变。`;
            status.dataset.state = 'success';
        }
    } catch (error) {
        console.error('[酒疫主题器] 加入本地主题失败', error);
        notify('error', error?.message || String(error));
    } finally {
        button.disabled = false;
        button.textContent = '加入酒馆主题列表（不启用）';
    }
}

async function removeLocalThemeRecord(recordId) {
    const records = await loadLocalThemeRecords();
    const target = records.find(record => record.id === recordId);
    if (!target || !window.confirm(`从主题器本地收藏中移除“${target.name}”吗？\n不会删除已经加入酒馆的同名主题。`)) {
        return;
    }
    await saveLocalThemeRecords(records.filter(record => record.id !== recordId));
    await renderLocalThemeLibrary();
}

function createLocalThemeCard(record) {
    const card = document.createElement('article');
    card.className = 'theme-subscriber-local-card';

    const heading = document.createElement('div');
    heading.className = 'theme-subscriber-local-heading';
    const title = document.createElement('strong');
    title.textContent = record.name;
    const badge = document.createElement('span');
    badge.textContent = '仅本地收藏';
    heading.append(title, badge);

    const meta = document.createElement('small');
    const importedAt = record.importedAt ? new Date(record.importedAt).toLocaleString('zh-CN') : '时间未知';
    meta.textContent = `${record.fileName} · ${formatLocalThemeSize(record.bytes)} · ${importedAt}`;

    const note = document.createElement('p');
    note.textContent = record.warnings.length
        ? `资源提示：${record.warnings.join(' ')}`
        : '文件格式已通过检查；尚未加入或启用到酒馆。';

    const actions = document.createElement('div');
    actions.className = 'theme-subscriber-local-actions';
    const install = document.createElement('button');
    install.type = 'button';
    install.className = 'menu_button';
    install.textContent = '加入酒馆主题列表（不启用）';
    install.addEventListener('click', () => void installLocalThemeRecord(record, install));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'menu_button';
    remove.textContent = '移出本地收藏';
    remove.addEventListener('click', () => void removeLocalThemeRecord(record.id));
    actions.append(install, remove);

    card.append(heading, meta, note, actions);
    return card;
}

async function renderLocalThemeLibrary() {
    const list = document.getElementById('theme-subscriber-local-list');
    if (!list) return;
    list.replaceChildren();
    try {
        const records = await loadLocalThemeRecords();
        if (!records.length) {
            const empty = document.createElement('small');
            empty.textContent = '还没有本地收藏的美化文件。';
            list.append(empty);
            return;
        }
        records.forEach(record => list.append(createLocalThemeCard(record)));
    } catch (error) {
        const failed = document.createElement('small');
        failed.textContent = error?.message || String(error);
        list.append(failed);
    }
}

async function importLocalThemeFile(file) {
    const status = document.getElementById('theme-subscriber-local-status');
    if (!(file instanceof File)) return;
    if (!file.name.toLocaleLowerCase('en-US').endsWith('.json')) {
        throw new Error('请选择 .json 美化文件。');
    }
    if (file.size <= 0 || file.size > MAX_THEME_BYTES) {
        throw new Error(`美化文件必须大于 0，并且不超过 ${Math.round(MAX_THEME_BYTES / 1024 / 1024)} MB。`);
    }

    const theme = validateTheme(parseJson(await file.text(), `文件“${file.name}”`));
    const records = await loadLocalThemeRecords();
    const existingIndex = records.findIndex(record => record.name === theme.name);
    if (existingIndex >= 0 && !window.confirm(`本地收藏中已有“${theme.name}”。用这次选择的文件替换它吗？`)) {
        if (status) status.textContent = '已取消替换，本地收藏没有改变。';
        return;
    }
    if (existingIndex < 0 && records.length >= MAX_LOCAL_THEME_COUNT) {
        throw new Error(`本地主题收藏最多保留 ${MAX_LOCAL_THEME_COUNT} 个文件。`);
    }

    const record = normalizeLocalThemeRecord({
        id: existingIndex >= 0 ? records[existingIndex].id : createLocalThemeId(),
        name: theme.name,
        fileName: file.name,
        importedAt: new Date().toISOString(),
        bytes: file.size,
        warnings: getThemeWarnings(theme),
        theme,
    });
    if (existingIndex >= 0) records.splice(existingIndex, 1, record);
    else records.unshift(record);
    await saveLocalThemeRecords(records);
    await renderLocalThemeLibrary();
    if (status) {
        status.textContent = `“${theme.name}”已收藏到主题器；没有加入酒馆，也没有切换当前主题。`;
        status.dataset.state = 'success';
    }
}

async function saveTheme(theme) {
    const response = await fetch('/api/themes/save', {
        method: 'POST',
        headers: ctx.getRequestHeaders(),
        body: JSON.stringify(theme),
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`酒馆保存主题失败：HTTP ${response.status}${detail ? ` · ${detail}` : ''}`);
    }
}

function activateExistingTheme(name) {
    const select = document.getElementById('themes');
    if (!(select instanceof HTMLSelectElement)) {
        return false;
    }
    const exists = Array.from(select.options).some(option => option.value === name);
    if (!exists) {
        return false;
    }
    select.value = name;
    $(select).trigger('change');
    notify('success', `已切换到“${name}”。`);
    return true;
}

function getCurrentThemeName() {
    const configured = String(ctx.powerUserSettings?.theme || '').trim();
    const select = document.getElementById('themes');
    return configured || (select instanceof HTMLSelectElement ? String(select.value || '').trim() : '');
}

function getAvailableThemeNames() {
    const select = document.getElementById('themes');
    if (!(select instanceof HTMLSelectElement)) {
        return [];
    }
    return Array.from(select.options).map(option => String(option.value || '').trim()).filter(Boolean);
}

function rememberPreviousTheme(nextTheme) {
    const currentTheme = getCurrentThemeName();
    if (!currentTheme || currentTheme === nextTheme) {
        return;
    }
    const settings = getSettings();
    settings.previousTheme = currentTheme;
    settings.lastBrokenTheme = '';
    ctx.saveSettingsDebounced();
}

function getRecoveryTarget(currentTheme = getCurrentThemeName()) {
    const settings = getSettings();
    const available = getAvailableThemeNames();
    if (settings.previousTheme && settings.previousTheme !== currentTheme && available.includes(settings.previousTheme)) {
        return settings.previousTheme;
    }
    return available.find(name => name !== currentTheme) || '';
}

function switchThemeImmediately(name) {
    if (!name) {
        throw new Error('没有找到可以返回的其他主题。');
    }
    const select = document.getElementById('themes');
    if (!(select instanceof HTMLSelectElement) || !Array.from(select.options).some(option => option.value === name)) {
        throw new Error(`上一个主题“${name}”目前不在酒馆主题列表中。`);
    }
    ctx.powerUserSettings.theme = name;
    ctx.saveSettingsDebounced();
    select.value = name;
    $(select).trigger('change');
}

async function recoverPreviousTheme() {
    const currentTheme = getCurrentThemeName();
    const targetTheme = getRecoveryTarget(currentTheme);
    if (!targetTheme) {
        notify('error', '没有找到其他可用主题，无法自动返回。');
        return;
    }
    try {
        const settings = getSettings();
        settings.lastBrokenTheme = currentTheme;
        settings.previousTheme = targetTheme;
        switchThemeImmediately(targetTheme);
        notify('success', `正在强制返回“${targetTheme}”。`);
        setTimeout(() => window.location.reload(), 250);
    } catch (error) {
        console.error('[酒疫主题器] 强制返回失败', error);
        notify('error', error?.message || String(error));
    }
}

function updateBrokenThemeDeleteButton() {
    const button = document.getElementById('theme-subscriber-delete-broken');
    const label = document.getElementById('theme-subscriber-broken-theme-name');
    if (!(button instanceof HTMLButtonElement)) {
        return;
    }
    const brokenTheme = getSettings().lastBrokenTheme.trim();
    button.disabled = !brokenTheme;
    if (label) {
        label.textContent = brokenTheme ? `已记录：${brokenTheme}` : '返回后会在这里记录刚才的坏主题。';
    }
}

async function deleteThemeByName(name) {
    const response = await fetch('/api/themes/delete', {
        method: 'POST',
        headers: ctx.getRequestHeaders(),
        body: JSON.stringify({ name }),
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`删除主题失败：HTTP ${response.status}${detail ? ` · ${detail}` : ''}`);
    }
    const select = document.getElementById('themes');
    if (select instanceof HTMLSelectElement) {
        for (const option of Array.from(select.options)) {
            if (option.value === name) option.remove();
        }
    }
    const settings = getSettings();
    for (const [id, installed] of Object.entries(settings.installed)) {
        if (installed?.name === name) delete settings.installed[id];
    }
    if (settings.lastBrokenTheme === name) settings.lastBrokenTheme = '';
    ctx.saveSettingsDebounced();
}

async function deleteRecordedBrokenTheme() {
    const settings = getSettings();
    const brokenTheme = settings.lastBrokenTheme.trim();
    const currentTheme = getCurrentThemeName();
    if (!brokenTheme) {
        notify('error', '还没有记录需要删除的坏主题。请先使用“返回上个主题”。');
        return;
    }
    const targetTheme = brokenTheme === currentTheme ? getRecoveryTarget(currentTheme) : currentTheme;
    if (!targetTheme || targetTheme === brokenTheme) {
        notify('error', '没有其他可用主题，不能安全删除这个主题。');
        return;
    }
    if (!window.confirm(`确定删除刚才的坏主题“${brokenTheme}”吗？${brokenTheme === currentTheme ? `\n会先强制切换到“${targetTheme}”，再删除本地主题文件。` : ''}`)) {
        return;
    }
    try {
        if (brokenTheme === currentTheme) {
            switchThemeImmediately(targetTheme);
        }
        await deleteThemeByName(brokenTheme);
        updateBrokenThemeDeleteButton();
        notify('success', `已删除坏主题“${brokenTheme}”。`);
        if (brokenTheme === currentTheme) {
            setTimeout(() => window.location.reload(), 250);
        }
    } catch (error) {
        console.error('[酒疫主题器] 删除坏主题失败', error);
        notify('error', error?.message || String(error));
    }
}

function removeRecoveryMenuEntry() {
    document.getElementById(RECOVERY_MENU_CONTAINER_ID)?.remove();
}

function applyRecoveryMenuStyles(container, item) {
    container.style.setProperty('display', 'block', 'important');
    container.style.setProperty('visibility', 'visible', 'important');
    container.style.setProperty('opacity', '1', 'important');
    item.style.setProperty('display', 'flex', 'important');
    item.style.setProperty('visibility', 'visible', 'important');
    item.style.setProperty('opacity', '1', 'important');
    item.style.setProperty('pointer-events', 'auto', 'important');
    item.style.setProperty('filter', 'none', 'important');
}

function ensureRecoveryMenuEntry() {
    if (!getSettings().recoveryEnabled) {
        removeRecoveryMenuEntry();
        return null;
    }
    const menu = document.getElementById('extensionsMenu');
    if (!menu) {
        return null;
    }
    let container = document.getElementById(RECOVERY_MENU_CONTAINER_ID);
    let item = document.getElementById(RECOVERY_MENU_ITEM_ID);
    if (!container || !item) {
        container?.remove();
        container = document.createElement('div');
        container.id = RECOVERY_MENU_CONTAINER_ID;
        container.className = 'extension_container';
        item = document.createElement('div');
        item.id = RECOVERY_MENU_ITEM_ID;
        item.className = 'theme-subscriber-recovery-wand-item interactable';
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        item.title = '返回安装或切换前的上一个主题（Ctrl+Alt+Shift+R）';
        item.innerHTML = '<span class="extensionsMenuExtensionButton theme-subscriber-recovery-spark" aria-hidden="true">✦</span><span>返回上个主题</span>';
        item.addEventListener('click', () => void recoverPreviousTheme());
        item.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                void recoverPreviousTheme();
            }
        });
        container.append(item);
        menu.append(container);
    }
    applyRecoveryMenuStyles(container, item);
    return item;
}

function installRecoveryShortcut() {
    window.addEventListener('keydown', event => {
        if (getSettings().recoveryEnabled
            && event.ctrlKey && event.altKey && event.shiftKey && event.key.toLowerCase() === RECOVERY_SHORTCUT_KEY) {
            event.preventDefault();
            event.stopImmediatePropagation();
            void recoverPreviousTheme();
        }
    }, true);
}

function scheduleThemeActivation(name) {
    rememberPreviousTheme(name);
    ctx.powerUserSettings.theme = name;
    ctx.saveSettingsDebounced();
    try {
        sessionStorage.setItem(PENDING_THEME_KEY, name);
    } catch (error) {
        console.warn('[酒疫主题器] 无法写入页面切换标记，将依靠酒馆设置切换主题。', error);
    }
    notify('success', `主题“${name}”已保存，正在自动刷新并切换。`);
    setTimeout(() => window.location.reload(), 1200);
}

function resumePendingThemeActivation() {
    let name = '';
    try {
        name = sessionStorage.getItem(PENDING_THEME_KEY) || '';
        sessionStorage.removeItem(PENDING_THEME_KEY);
    } catch (error) {
        console.warn('[酒疫主题器] 无法读取页面切换标记。', error);
    }
    if (name && !activateExistingTheme(name)) {
        notify('warning', `“${name}”已安装，但暂未出现在主题列表中，请再刷新一次。`);
    }
}

async function installTheme(entry, button) {
    const settings = getSettings();
    const installed = settings.installed[entry.id];
    if (installed?.version === entry.version && installed?.themeUrl === entry.themeUrl) {
        rememberPreviousTheme(entry.themeName);
        if (activateExistingTheme(entry.themeName)) {
            return;
        }
    }

    button.disabled = true;
    button.textContent = '正在下载…';

    try {
        const resource = await fetchResource(entry.themeUrl, MAX_THEME_BYTES, `主题“${entry.name}”`);
        button.textContent = '正在解析…';
        const theme = validateTheme(parseJson(resource.text, `主题“${entry.name}”`), entry.themeName);
        const warnings = getThemeWarnings(theme);
        if (warnings.length) {
            console.info(`[酒疫主题器] “${entry.name}”资源提示：${warnings.join(' ')}`);
        }

        button.textContent = '正在保存…';
        await saveTheme(theme);
        settings.installed[entry.id] = {
            name: entry.themeName,
            version: entry.version,
            versionName: entry.versionName,
            themeUrl: entry.themeUrl,
            installedAt: new Date().toISOString(),
        };
        ctx.saveSettingsDebounced();
        scheduleThemeActivation(entry.themeName);
    } catch (error) {
        console.error('[酒疫主题器] 安装失败', error);
        notify('error', error?.message || String(error));
        updateInstallButton(button, entry, installed);
    } finally {
        button.disabled = false;
    }
}

function updateInstallButton(button, entry, installed) {
    button.classList.remove('theme-subscriber-installed');
    if (!installed) {
        button.textContent = '安装并切换';
        return;
    }
    if (installed.version === entry.version && installed.themeUrl === entry.themeUrl) {
        button.textContent = '切换';
        button.classList.add('theme-subscriber-installed');
        return;
    }
    button.textContent = '安装此版本并切换';
}

function createVersionControls(entry, versions, installed, label) {
    const wrapper = document.createElement('div');
    wrapper.className = 'theme-subscriber-version-controls';

    const versionRow = document.createElement('label');
    versionRow.className = 'theme-subscriber-version-row';
    const versionLabel = document.createElement('span');
    versionLabel.textContent = label;
    const versionSelect = document.createElement('select');
    versionSelect.className = 'text_pole theme-subscriber-version-select';
    for (const versionEntry of versions) {
        const option = document.createElement('option');
        option.value = versionEntry.version;
        const markers = [];
        if (versionEntry.version === entry.defaultVersion) markers.push('推荐');
        if (versionEntry.version === entry.latestVersion) markers.push('最新');
        option.textContent = `${versionEntry.versionName}${markers.length ? ` · ${markers.join(' / ')}` : ''}`;
        versionSelect.append(option);
    }
    versionRow.append(versionLabel, versionSelect);

    const changelog = document.createElement('p');
    changelog.className = 'theme-subscriber-changelog';
    const meta = document.createElement('small');
    meta.className = 'theme-subscriber-meta';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'menu_button theme-subscriber-install';
    let selectedVersion = versions[0];
    const refreshSelectedVersion = () => {
        selectedVersion = versions.find(item => item.version === versionSelect.value) || versions[0];
        changelog.textContent = `更新记录：${selectedVersion.changelog}`;
        const stateLabel = selectedVersion.approved ? '正式版' : '测试版';
        meta.textContent = `${selectedVersion.versionName} · ${stateLabel}`;
        updateInstallButton(button, selectedVersion, installed);
    };
    versionSelect.addEventListener('change', refreshSelectedVersion);
    button.addEventListener('click', () => installTheme(selectedVersion, button));
    refreshSelectedVersion();

    wrapper.append(versionRow, changelog, meta, button);
    return wrapper;
}

function createThemeIdentityFallback(entry) {
    const fallback = document.createElement('div');
    fallback.className = 'theme-subscriber-identity-fallback';
    const mark = document.createElement('strong');
    mark.textContent = Array.from(entry.displayName).slice(0, 2).join('');
    const note = document.createElement('small');
    note.textContent = '主题标识生成中';
    fallback.append(mark, note);
    return fallback;
}

function closeThemePreview() {
    document.getElementById('theme-subscriber-preview-modal')?.remove();
    if (previewReturnFocus instanceof HTMLElement && document.contains(previewReturnFocus)) {
        previewReturnFocus.focus();
    }
    previewReturnFocus = null;
    previewGalleryIndex = -1;
}

function renderThemePreview(entryIndex) {
    const modal = document.getElementById('theme-subscriber-preview-modal');
    if (!modal || previewGalleryEntries.length === 0) return;
    previewGalleryIndex = (entryIndex + previewGalleryEntries.length) % previewGalleryEntries.length;
    const entry = previewGalleryEntries[previewGalleryIndex];
    const media = modal.querySelector('.theme-subscriber-preview-modal-media');
    const title = modal.querySelector('.theme-subscriber-preview-modal-title');
    const meta = modal.querySelector('.theme-subscriber-preview-modal-meta');
    const description = modal.querySelector('.theme-subscriber-preview-modal-description');
    const source = modal.querySelector('.theme-subscriber-preview-modal-source');
    const position = modal.querySelector('.theme-subscriber-preview-modal-position');
    const previous = modal.querySelector('.theme-subscriber-preview-previous');
    const next = modal.querySelector('.theme-subscriber-preview-next');

    title.textContent = entry.displayName;
    meta.textContent = entry.appearance === 'light' ? '☀ 日间主题' : '☾ 夜间主题';
    description.textContent = entry.description || '暂无说明';
    position.textContent = `${previewGalleryIndex + 1} / ${previewGalleryEntries.length}`;
    previous.disabled = previewGalleryEntries.length < 2;
    next.disabled = previewGalleryEntries.length < 2;
    media.replaceChildren();

    const visualUrl = entry.previewUrl || entry.logoUrl;
    if (visualUrl) {
        const image = document.createElement('img');
        image.className = entry.previewUrl
            ? 'theme-subscriber-preview-modal-image'
            : 'theme-subscriber-preview-modal-image theme-subscriber-preview-modal-logo';
        image.src = visualUrl;
        image.alt = entry.previewUrl ? `${entry.displayName}主题真实截图` : entry.logoAlt;
        image.referrerPolicy = 'no-referrer';
        image.addEventListener('error', () => {
            media.replaceChildren(createThemeIdentityFallback(entry));
            source.textContent = '当前主题的预览资源加载失败。';
        }, { once: true });
        media.append(image);
        source.textContent = entry.previewUrl
            ? '正在查看主题真实截图；预览不会安装或切换主题。'
            : '此主题暂无真实界面截图，当前只显示主题 Logo。';
    } else {
        media.append(createThemeIdentityFallback(entry));
        source.textContent = '此主题暂无真实界面截图或 Logo。';
    }
}

function stepThemePreview(offset) {
    if (previewGalleryIndex < 0 || previewGalleryEntries.length < 2) return;
    renderThemePreview(previewGalleryIndex + offset);
}

function openThemePreview(entry, trigger) {
    closeThemePreview();
    previewReturnFocus = trigger instanceof HTMLElement ? trigger : null;
    if (!previewGalleryEntries.some(item => item.id === entry.id)) {
        previewGalleryEntries = [entry];
    }

    const overlay = document.createElement('div');
    overlay.id = 'theme-subscriber-preview-modal';
    overlay.className = 'theme-subscriber-preview-modal';
    const dialog = document.createElement('section');
    dialog.className = 'theme-subscriber-preview-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'theme-subscriber-preview-title');

    const header = document.createElement('header');
    header.className = 'theme-subscriber-preview-modal-header';
    const heading = document.createElement('div');
    const title = document.createElement('strong');
    title.id = 'theme-subscriber-preview-title';
    title.className = 'theme-subscriber-preview-modal-title';
    const meta = document.createElement('span');
    meta.className = 'theme-subscriber-preview-modal-meta';
    heading.append(title, meta);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'theme-subscriber-preview-close';
    close.setAttribute('aria-label', '关闭主题预览');
    close.textContent = '×';
    close.addEventListener('click', closeThemePreview);
    header.append(heading, close);

    const media = document.createElement('div');
    media.className = 'theme-subscriber-preview-modal-media';
    let pointerStartX = null;
    media.addEventListener('pointerdown', event => {
        if (event.isPrimary) pointerStartX = event.clientX;
    });
    media.addEventListener('pointerup', event => {
        if (pointerStartX === null || !event.isPrimary) return;
        const distance = event.clientX - pointerStartX;
        pointerStartX = null;
        if (Math.abs(distance) >= 48) stepThemePreview(distance < 0 ? 1 : -1);
    });
    media.addEventListener('pointercancel', () => {
        pointerStartX = null;
    });

    const details = document.createElement('div');
    details.className = 'theme-subscriber-preview-modal-details';
    const description = document.createElement('p');
    description.className = 'theme-subscriber-preview-modal-description';
    const source = document.createElement('small');
    source.className = 'theme-subscriber-preview-modal-source';
    details.append(description, source);

    const controls = document.createElement('div');
    controls.className = 'theme-subscriber-preview-modal-controls';
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'menu_button theme-subscriber-preview-previous';
    previous.textContent = '← 上一个';
    previous.addEventListener('click', () => stepThemePreview(-1));
    const position = document.createElement('span');
    position.className = 'theme-subscriber-preview-modal-position';
    position.setAttribute('aria-live', 'polite');
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'menu_button theme-subscriber-preview-next';
    next.textContent = '下一个 →';
    next.addEventListener('click', () => stepThemePreview(1));
    controls.append(previous, position, next);

    dialog.append(header, media, details, controls);
    overlay.append(dialog);
    overlay.addEventListener('click', event => {
        if (event.target === overlay) closeThemePreview();
    });
    dialog.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeThemePreview();
        else if (event.key === 'ArrowLeft') stepThemePreview(-1);
        else if (event.key === 'ArrowRight') stepThemePreview(1);
    });
    document.body.append(overlay);

    const startIndex = previewGalleryEntries.findIndex(item => item.id === entry.id);
    renderThemePreview(Math.max(0, startIndex));
    close.focus();
}

function createThemeCard(entry, options = {}) {
    const settings = getSettings();
    const installed = settings.installed[entry.id];
    const approvedVersions = entry.versions.filter(item => item.approved);
    const otherVersions = entry.versions.filter(item => !item.approved);
    const showOnlyUnapproved = options.showOnlyUnapproved === true;
    const card = document.createElement('article');
    card.className = 'theme-subscriber-card';
    card.dataset.appearance = entry.appearance;
    card.dataset.themeId = entry.id;

    const preview = document.createElement('div');
    preview.className = 'theme-subscriber-preview-shell';
    const visualUrl = entry.logoUrl || entry.previewUrl;
    if (visualUrl) {
        const image = document.createElement('img');
        image.className = entry.logoUrl ? 'theme-subscriber-logo' : 'theme-subscriber-preview';
        image.src = visualUrl;
        image.alt = entry.logoUrl ? entry.logoAlt : `${entry.displayName}主题截图`;
        image.loading = 'lazy';
        image.referrerPolicy = 'no-referrer';
        image.addEventListener('error', () => image.replaceWith(createThemeIdentityFallback(entry)), { once: true });
        preview.append(image);
    } else {
        preview.append(createThemeIdentityFallback(entry));
    }
    const appearanceLabel = document.createElement('span');
    appearanceLabel.className = 'theme-subscriber-appearance-badge';
    appearanceLabel.textContent = entry.appearance === 'light' ? '☀ 日间主题' : '☾ 夜间主题';
    const quickPreview = document.createElement('button');
    quickPreview.type = 'button';
    quickPreview.className = 'theme-subscriber-quick-preview';
    quickPreview.setAttribute('aria-label', `快速预览${entry.displayName}`);
    quickPreview.innerHTML = '<i class="fa-solid fa-eye" aria-hidden="true"></i><span>快速预览</span>';
    quickPreview.addEventListener('click', () => openThemePreview(entry, quickPreview));
    preview.append(appearanceLabel, quickPreview);
    card.append(preview);

    const content = document.createElement('div');
    content.className = 'theme-subscriber-card-content';

    const heading = document.createElement('div');
    heading.className = 'theme-subscriber-card-heading';
    const title = document.createElement('strong');
    title.textContent = entry.displayName;
    const version = document.createElement('span');
    version.className = 'theme-subscriber-version';
    version.textContent = showOnlyUnapproved
        ? `${otherVersions.length} 个测试版本`
        : `${approvedVersions.length} 个正式版本`;
    heading.append(title, version);

    const description = document.createElement('p');
    description.textContent = entry.description || '暂无说明';

    content.append(heading, description);
    if (showOnlyUnapproved) {
        content.append(createVersionControls(entry, otherVersions, installed, '选择测试版'));
    } else {
        content.append(createVersionControls(entry, approvedVersions, installed, '选择正式版'));
        if (otherVersions.length > 0) {
            const other = document.createElement('details');
            other.className = 'theme-subscriber-other-versions';
            const summary = document.createElement('summary');
            summary.textContent = `其他版本（${otherVersions.length}）`;
            other.append(summary, createVersionControls(entry, otherVersions, installed, '选择测试版'));
            content.append(other);
        }
    }
    card.append(content);
    return card;
}

function renderCatalog(catalog) {
    const list = document.getElementById('theme-subscriber-list');
    const status = document.getElementById('theme-subscriber-status');
    const tabs = document.getElementById('theme-subscriber-tabs');
    list.replaceChildren();
    tabs.replaceChildren();
    setFeedbackThemes(catalog.themes);

    if (catalog.themes.length === 0) {
        status.textContent = `${catalog.name}：当前没有已发布主题。`;
        return;
    }

    const approvedThemes = catalog.themes.filter(theme => theme.versions.some(version => version.approved));
    const approvedVersionCount = catalog.themes.reduce((total, theme) => total + theme.versions.filter(version => version.approved).length, 0);
    const hiddenVersionCount = catalog.themes.reduce((total, theme) => total + theme.versions.filter(version => !version.approved).length, 0);
    const updatedText = catalog.updatedAt
        ? new Date(catalog.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '刚刚';
    status.textContent = `${approvedThemes.length} 个公开主题 · ${approvedVersionCount} 个正式版本 · ${hiddenVersionCount} 个隐藏测试版本 · ${updatedText} 同步`;

    const groups = [
        { appearance: 'light', icon: '☀', label: '日间主题', description: '浅色背景与深色正文为主要阅读关系' },
        { appearance: 'dark', icon: '☾', label: '夜间主题', description: '深色背景与浅色正文为主要阅读关系' },
    ];
    const renderGroup = appearance => {
        const group = groups.find(item => item.appearance === appearance);
        const entries = approvedThemes.filter(theme => theme.appearance === appearance);
        const testingOnlyEntries = catalog.themes.filter(theme => theme.appearance === appearance && !theme.versions.some(version => version.approved));
        const installedTestingEntries = testingOnlyEntries.filter(theme => Boolean(getSettings().installed[theme.id]));
        const uninstalledTestingEntries = testingOnlyEntries.filter(theme => !getSettings().installed[theme.id]);
        previewGalleryEntries = [...entries, ...installedTestingEntries];
        list.replaceChildren();
        const heading = document.createElement('div');
        heading.className = 'theme-subscriber-group-heading';
        heading.dataset.appearance = appearance;
        const headingTitle = document.createElement('strong');
        headingTitle.textContent = `${group.icon} ${group.label}`;
        const headingDescription = document.createElement('span');
        headingDescription.textContent = group.description;
        heading.append(headingTitle, headingDescription);
        list.append(heading);
        entries.forEach(entry => list.append(createThemeCard(entry)));
        if (installedTestingEntries.length > 0) {
            const installedTestingHeading = document.createElement('p');
            installedTestingHeading.className = 'theme-subscriber-installed-testing-heading';
            installedTestingHeading.textContent = '已安装测试主题';
            list.append(installedTestingHeading);
            installedTestingEntries.forEach(entry => list.append(createThemeCard(entry, { showOnlyUnapproved: true })));
        }
        if (uninstalledTestingEntries.length > 0) {
            const testing = document.createElement('details');
            testing.className = 'theme-subscriber-testing-library';
            const summary = document.createElement('summary');
            summary.textContent = `其他测试主题（${uninstalledTestingEntries.length}）`;
            const testingList = document.createElement('div');
            testingList.className = 'theme-subscriber-testing-list';
            uninstalledTestingEntries.forEach(entry => testingList.append(createThemeCard(entry, { showOnlyUnapproved: true })));
            testing.append(summary, testingList);
            list.append(testing);
        }
        for (const tab of tabs.querySelectorAll('button')) {
            const selected = tab.dataset.appearance === appearance;
            tab.classList.toggle('theme-subscriber-tab-active', selected);
            tab.setAttribute('aria-selected', String(selected));
        }
    };
    for (const group of groups) {
        const count = catalog.themes.filter(theme => theme.appearance === group.appearance).length;
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'theme-subscriber-tab';
        tab.dataset.appearance = group.appearance;
        tab.setAttribute('role', 'tab');
        tab.textContent = `${group.icon} ${group.label} · ${count}`;
        tab.addEventListener('click', () => renderGroup(group.appearance));
        tabs.append(tab);
    }
    renderGroup(catalog.themes.some(theme => theme.appearance === 'light') ? 'light' : 'dark');
}

async function loadCatalog() {
    const button = document.getElementById('theme-subscriber-refresh');
    const input = document.getElementById('theme-subscriber-url');
    const status = document.getElementById('theme-subscriber-status');
    const settings = getSettings();
    button.disabled = true;
    button.textContent = '检查中…';
    status.textContent = '正在读取远程主题目录…';

    try {
        const catalogUrl = requireTrustedUrl(input.value.trim(), '主题目录地址');
        settings.catalogUrl = catalogUrl;
        const catalogText = await fetchCatalogText(catalogUrl);
        const catalog = validateCatalog(parseJson(catalogText, '主题目录'));
        settings.lastCheckedAt = new Date().toISOString();
        ctx.saveSettingsDebounced();
        renderCatalog(catalog);
    } catch (error) {
        console.error('[酒疫主题器] 目录加载失败', error);
        status.textContent = error?.message || String(error);
        document.getElementById('theme-subscriber-list').replaceChildren();
        notify('error', status.textContent);
    } finally {
        button.disabled = false;
        button.textContent = '检查更新';
    }
}

function createPanel() {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'extension_container';

    const drawer = document.createElement('div');
    drawer.className = 'inline-drawer';
    drawer.innerHTML = `
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>酒疫主题器</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <div class="theme-subscriber-hero">
                <div>
                    <small class="theme-subscriber-eyebrow">THEME LIBRARY</small>
                    <h3>酒疫主题库</h3>
                    <p>远程安装、保留版本、随时切换</p>
                </div>
                <button id="theme-subscriber-refresh" class="menu_button theme-subscriber-refresh" type="button">
                    <i class="fa-solid fa-rotate" aria-hidden="true"></i>
                    <span>检查更新</span>
                </button>
            </div>
            <div id="theme-subscriber-status" class="theme-subscriber-status" aria-live="polite">尚未检查主题目录。</div>
            <div id="theme-subscriber-tabs" class="theme-subscriber-tabs" role="tablist" aria-label="主题显示模式"></div>
            <div id="theme-subscriber-list" class="theme-subscriber-list"></div>
            <details class="theme-subscriber-local-import">
                <summary>导入本地美化文件</summary>
                <div class="theme-subscriber-local-import-body">
                    <p>选择 JSON 后只收藏到主题器，不会加入酒馆、不会启用，也不会改变当前主题。</p>
                    <input id="theme-subscriber-local-file" type="file" accept=".json,application/json" hidden>
                    <button id="theme-subscriber-local-choose" class="menu_button" type="button">选择 JSON 美化文件</button>
                    <p id="theme-subscriber-local-status" class="theme-subscriber-local-status" role="status" aria-live="polite">等待选择文件。</p>
                    <div id="theme-subscriber-local-list" class="theme-subscriber-local-list"></div>
                </div>
            </details>
            <section class="theme-subscriber-safety" aria-labelledby="theme-subscriber-safety-title">
                <div>
                    <strong id="theme-subscriber-safety-title">主题防呆保护</strong>
                    <small>开启后，魔棒菜单会出现一个“✦ 返回上个主题”入口，同时启用电脑快捷键 Ctrl+Alt+Shift+R。</small>
                </div>
                <label class="checkbox_label theme-subscriber-safety-toggle" for="theme-subscriber-recovery-enabled">
                    <input id="theme-subscriber-recovery-enabled" type="checkbox">
                    <span>在魔棒中显示返回入口</span>
                </label>
                <button id="theme-subscriber-delete-broken" class="menu_button" type="button" disabled>删除刚才的坏主题</button>
                <small id="theme-subscriber-broken-theme-name">返回后会在这里记录刚才的坏主题。</small>
            </section>
            <div id="theme-subscriber-css-helper-slot"></div>
            <details class="theme-subscriber-feedback">
                <summary>玩家反馈与功能建议</summary>
                <div class="theme-subscriber-feedback-form">
                    <label for="theme-subscriber-feedback-search">搜索主题</label>
                    <input id="theme-subscriber-feedback-search" class="text_pole" type="search" placeholder="输入主题名筛选">
                    <label for="theme-subscriber-feedback-theme">选择主题</label>
                    <select id="theme-subscriber-feedback-theme" class="text_pole">
                        <option value="酒疫主题器（通用功能）">酒疫主题器（通用功能）</option>
                    </select>
                    <label for="theme-subscriber-feedback-type">反馈类型</label>
                    <select id="theme-subscriber-feedback-type" class="text_pole">
                        <option value="功能建议">功能建议</option>
                        <option value="主题显示问题">主题显示问题</option>
                        <option value="希望增加日间或夜间模式">希望增加日间或夜间模式</option>
                        <option value="其他反馈">其他反馈</option>
                    </select>
                    <label for="theme-subscriber-feedback-message">希望增加或修改什么</label>
                    <textarea id="theme-subscriber-feedback-message" class="text_pole" rows="5" maxlength="3000" placeholder="例如：希望这个主题增加夜间模式；希望手机版按钮更大。"></textarea>
                    <label for="theme-subscriber-feedback-device">设备 / SillyTavern版本（可选）</label>
                    <input id="theme-subscriber-feedback-device" class="text_pole" type="text" maxlength="120" placeholder="例如：安卓手机，SillyTavern 1.14">
                    <button id="theme-subscriber-feedback-submit" class="menu_button" type="button">在酒馆内发送反馈</button>
                    <p id="theme-subscriber-feedback-status" class="theme-subscriber-feedback-status" role="status" aria-live="polite">填写后由你点击发送；不会跳转 GitHub 或打开其他页面。</p>
                    <small>只发送上面主动填写的主题、类型、建议和可选设备信息；不会读取聊天内容、密钥、Cookie或私人设置。</small>
                </div>
            </details>
            <details class="theme-subscriber-connection">
                <summary>主题库连接设置</summary>
                <label for="theme-subscriber-url">主题目录地址</label>
                <div class="theme-subscriber-url-row">
                    <input id="theme-subscriber-url" class="text_pole" type="url" inputmode="url" autocomplete="off" spellcheck="false">
                </div>
                <small>目录默认从 GitHub Raw 读取，并自动尝试 jsDelivr 备用地址；下载后只检查主题JSON格式与名称，不再因目录哈希不一致阻止安装。</small>
            </details>
        </div>`;

    drawer.querySelector('#theme-subscriber-css-helper-slot')?.replaceWith(createCssQuickHelper());

    panel.append(drawer);
    return panel;
}

function initialize() {
    ensureRecoveryMenuEntry();
    if (document.getElementById(PANEL_ID)) {
        return;
    }
    const container = document.getElementById('extensions_settings2');
    if (!container) {
        console.error('[酒疫主题器] 找不到扩展设置容器。');
        return;
    }

    const panel = createPanel();
    container.append(panel);

    const settings = getSettings();
    const input = document.getElementById('theme-subscriber-url');
    input.value = settings.catalogUrl;
    input.addEventListener('change', () => {
        settings.catalogUrl = input.value.trim();
        ctx.saveSettingsDebounced();
    });
    const recoveryToggle = document.getElementById('theme-subscriber-recovery-enabled');
    recoveryToggle.checked = settings.recoveryEnabled;
    recoveryToggle.addEventListener('input', () => {
        settings.recoveryEnabled = recoveryToggle.checked;
        ctx.saveSettingsDebounced();
        ensureRecoveryMenuEntry();
        notify('success', settings.recoveryEnabled ? '已在魔棒中开启返回保护。' : '已关闭魔棒返回保护。');
    });
    document.getElementById('theme-subscriber-delete-broken').addEventListener('click', deleteRecordedBrokenTheme);
    updateBrokenThemeDeleteButton();
    document.getElementById('theme-subscriber-feedback-search').addEventListener('input', event => {
        updateFeedbackThemeOptions(event.currentTarget.value);
    });
    document.getElementById('theme-subscriber-feedback-submit').addEventListener('click', () => void submitPlayerFeedback());
    updateFeedbackThemeOptions();
    const localFileInput = document.getElementById('theme-subscriber-local-file');
    document.getElementById('theme-subscriber-local-choose').addEventListener('click', () => {
        localFileInput.value = '';
        localFileInput.click();
    });
    localFileInput.addEventListener('change', async () => {
        const status = document.getElementById('theme-subscriber-local-status');
        try {
            if (status) {
                status.textContent = '正在检查并收藏文件…';
                status.dataset.state = 'busy';
            }
            await importLocalThemeFile(localFileInput.files?.[0]);
        } catch (error) {
            console.error('[酒疫主题器] 本地主题收藏失败', error);
            if (status) {
                status.textContent = error?.message || String(error);
                status.dataset.state = 'error';
            }
            notify('error', error?.message || String(error));
        }
    });
    void renderLocalThemeLibrary();
    document.getElementById('theme-subscriber-refresh').addEventListener('click', loadCatalog);
    resumePendingThemeActivation();
    void loadCatalog();
}

installRecoveryShortcut();
ensureRecoveryMenuEntry();
setInterval(ensureRecoveryMenuEntry, 1500);

if (eventTypes?.APP_READY) {
    ctx.eventSource.on(eventTypes.APP_READY, initialize);
} else {
    $(initialize);
}

console.log('[酒疫主题器] 扩展脚本已加载');
