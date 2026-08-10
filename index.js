const EXTENSION_KEY = 'theme_subscriber';
const PANEL_ID = 'theme-subscriber-panel';
const PENDING_THEME_KEY = 'theme-subscriber:pending-theme';
const LEGACY_CATALOG_URL = 'https://raw.githubusercontent.com/jiuyi777/sillytavern-theme-assets/main/themes/catalog.json';
const MUTABLE_CATALOG_URL = 'https://raw.githubusercontent.com/jiuyi777/sillytavern-theme-assets/main/assets/%E5%9C%A8%E7%BA%BF%E4%B8%BB%E9%A2%98%E5%BA%93/catalog.json';
const PREVIOUS_CATALOG_URL = 'https://raw.githubusercontent.com/jiuyi777/sillytavern-theme-assets/e8f96b7ab7795e1a731c6775a68c9fe82edda135/assets/%E5%9C%A8%E7%BA%BF%E4%B8%BB%E9%A2%98%E5%BA%93/catalog.json';
const PINNED_CATALOG_URL = 'https://raw.githubusercontent.com/jiuyi777/sillytavern-theme-assets/0f5107ad7851b767197eeb65ccf8a219350ac5da/assets/%E5%9C%A8%E7%BA%BF%E4%B8%BB%E9%A2%98%E5%BA%93/catalog.json';
const DEFAULT_CATALOG_URL = 'https://api.github.com/repos/jiuyi777/sillytavern-theme-assets/contents/assets/%E5%9C%A8%E7%BA%BF%E4%B8%BB%E9%A2%98%E5%BA%93/catalog.json?ref=main';
const MAX_CATALOG_BYTES = 2 * 1024 * 1024;
const MAX_CATALOG_RESPONSE_BYTES = Math.ceil(MAX_CATALOG_BYTES * 4 / 3) + 64 * 1024;
const MAX_THEME_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20000;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
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

const ctx = SillyTavern.getContext();
const eventTypes = ctx.eventTypes || ctx.event_types;

const DEFAULT_SETTINGS = Object.freeze({
    catalogUrl: DEFAULT_CATALOG_URL,
    installed: {},
    lastCheckedAt: '',
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
        || settings.catalogUrl === LEGACY_CATALOG_URL
        || settings.catalogUrl === MUTABLE_CATALOG_URL
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
    return settings;
}

function notify(kind, message, title = '主题订阅器') {
    const handler = window.toastr?.[kind];
    if (typeof handler === 'function') {
        handler(message, title);
    } else {
        console[kind === 'error' ? 'error' : 'log'](`[${title}] ${message}`);
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(safeUrl, {
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
        if (error?.name === 'AbortError') {
            throw new Error(`${label}请求超时。`);
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
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

function normalizeThemeEntry(entry, index) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new Error(`目录中的第 ${index + 1} 个主题格式无效。`);
    }

    const id = String(entry.id || '').trim();
    const name = String(entry.name || '').trim();
    const version = String(entry.version || '').trim();
    const themeUrl = requireTrustedUrl(entry.theme_url, `主题“${name || id || index + 1}”地址`);
    const sha256 = String(entry.sha256 || '').trim().toLowerCase();

    if (!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(id)) {
        throw new Error(`主题“${name || index + 1}”的 id 无效。`);
    }
    if (!name || name.length > 128) {
        throw new Error(`主题 ${id} 的名称无效。`);
    }
    if (!version || version.length > 40) {
        throw new Error(`主题“${name}”的版本无效。`);
    }
    if (!SHA256_PATTERN.test(sha256)) {
        throw new Error(`主题“${name}”缺少有效 SHA-256，已拒绝不受校验的安装。`);
    }

    return {
        id,
        name,
        version,
        themeUrl,
        sha256,
        description: String(entry.description || '').trim().slice(0, 500),
        previewUrl: entry.preview_url ? requireTrustedUrl(entry.preview_url, `主题“${name}”预览地址`) : '',
        minimumClientVersion: String(entry.minimum_client_version || '').trim().slice(0, 40),
        updatedAt: String(entry.updated_at || '').trim().slice(0, 80),
    };
}

function validateCatalog(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('主题目录根节点必须是对象。');
    }
    if (value.schema_version !== 1) {
        throw new Error(`不支持的目录版本：${String(value.schema_version)}`);
    }
    if (!Array.isArray(value.themes)) {
        throw new Error('主题目录缺少 themes 数组。');
    }
    if (value.themes.length > 200) {
        throw new Error('主题目录项目过多。');
    }

    const themes = value.themes.map(normalizeThemeEntry);
    if (new Set(themes.map(theme => theme.id)).size !== themes.length) {
        throw new Error('主题目录包含重复 id。');
    }

    return {
        name: String(value.name || 'GitHub 主题库').trim().slice(0, 120),
        updatedAt: String(value.updated_at || '').trim().slice(0, 80),
        themes,
    };
}

async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function validateTheme(theme, expectedName) {
    if (!theme || typeof theme !== 'object' || Array.isArray(theme)) {
        throw new Error('主题文件根节点必须是对象。');
    }
    if (typeof theme.name !== 'string' || !theme.name.trim() || theme.name.length > 128) {
        throw new Error('主题文件缺少有效 name。');
    }
    if (theme.name !== expectedName) {
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

function scheduleThemeActivation(name) {
    ctx.powerUserSettings.theme = name;
    ctx.saveSettingsDebounced();
    try {
        sessionStorage.setItem(PENDING_THEME_KEY, name);
    } catch (error) {
        console.warn('[主题订阅器] 无法写入页面切换标记，将依靠酒馆设置切换主题。', error);
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
        console.warn('[主题订阅器] 无法读取页面切换标记。', error);
    }
    if (name && !activateExistingTheme(name)) {
        notify('warning', `“${name}”已安装，但暂未出现在主题列表中，请再刷新一次。`);
    }
}

async function installTheme(entry, button) {
    const settings = getSettings();
    const installed = settings.installed[entry.id];
    if (installed?.sha256 === entry.sha256 && activateExistingTheme(entry.name)) {
        return;
    }

    const action = installed ? '更新' : '安装';
    button.disabled = true;
    button.textContent = `${action}中…`;

    try {
        const resource = await fetchResource(entry.themeUrl, MAX_THEME_BYTES, `主题“${entry.name}”`);
        const actualHash = await sha256Hex(resource.bytes);
        if (actualHash !== entry.sha256) {
            throw new Error(`主题“${entry.name}”的 SHA-256 与目录记录不一致，已停止安装。`);
        }

        const theme = validateTheme(parseJson(resource.text, `主题“${entry.name}”`), entry.name);
        const warnings = getThemeWarnings(theme);
        if (warnings.length) {
            console.info(`[主题订阅器] “${entry.name}”资源提示：${warnings.join(' ')}`);
        }

        await saveTheme(theme);
        settings.installed[entry.id] = {
            name: entry.name,
            version: entry.version,
            sha256: entry.sha256,
            themeUrl: entry.themeUrl,
            installedAt: new Date().toISOString(),
        };
        ctx.saveSettingsDebounced();
        scheduleThemeActivation(entry.name);
    } catch (error) {
        console.error('[主题订阅器] 安装失败', error);
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
    if (installed.sha256 === entry.sha256) {
        button.textContent = '切换';
        button.classList.add('theme-subscriber-installed');
        return;
    }
    button.textContent = '更新并切换';
}

function createThemeCard(entry) {
    const settings = getSettings();
    const installed = settings.installed[entry.id];
    const card = document.createElement('article');
    card.className = 'theme-subscriber-card';

    if (entry.previewUrl) {
        const image = document.createElement('img');
        image.className = 'theme-subscriber-preview';
        image.src = entry.previewUrl;
        image.alt = `${entry.name}主题预览`;
        image.loading = 'lazy';
        image.referrerPolicy = 'no-referrer';
        card.append(image);
    } else {
        card.classList.add('theme-subscriber-card-no-preview');
    }

    const content = document.createElement('div');
    content.className = 'theme-subscriber-card-content';

    const heading = document.createElement('div');
    heading.className = 'theme-subscriber-card-heading';
    const title = document.createElement('strong');
    title.textContent = entry.name;
    const version = document.createElement('span');
    version.className = 'theme-subscriber-version';
    version.textContent = `v${entry.version}`;
    heading.append(title, version);

    const description = document.createElement('p');
    description.textContent = entry.description || '暂无说明';

    const meta = document.createElement('small');
    meta.textContent = `SHA-256 ${entry.sha256.slice(0, 12)}…${entry.minimumClientVersion ? ` · ST ≥ ${entry.minimumClientVersion}` : ''}`;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'menu_button theme-subscriber-install';
    updateInstallButton(button, entry, installed);
    button.addEventListener('click', () => installTheme(entry, button));

    content.append(heading, description, meta, button);
    card.append(content);
    return card;
}

function renderCatalog(catalog) {
    const list = document.getElementById('theme-subscriber-list');
    const status = document.getElementById('theme-subscriber-status');
    list.replaceChildren();

    if (catalog.themes.length === 0) {
        status.textContent = `${catalog.name}：当前没有已发布主题。`;
        return;
    }

    status.textContent = `${catalog.name} · ${catalog.themes.length} 个主题${catalog.updatedAt ? ` · 更新于 ${catalog.updatedAt}` : ''}`;
    for (const entry of catalog.themes) {
        list.append(createThemeCard(entry));
    }
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
        console.error('[主题订阅器] 目录加载失败', error);
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
            <b>GitHub 主题订阅器</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <label for="theme-subscriber-url">主题目录地址</label>
            <div class="theme-subscriber-url-row">
                <input id="theme-subscriber-url" class="text_pole" type="url" inputmode="url" autocomplete="off" spellcheck="false">
                <button id="theme-subscriber-refresh" class="menu_button" type="button">检查更新</button>
            </div>
            <small>仅接受 GitHub、GitHub Pages 和 jsDelivr 的 HTTPS 地址；安装前必须通过 SHA-256 校验。点击主题按钮即安装或更新并自动切换，主题声明的远程字体和图片会随主题加载。</small>
            <div id="theme-subscriber-status" class="theme-subscriber-status" aria-live="polite">尚未检查主题目录。</div>
            <div id="theme-subscriber-list" class="theme-subscriber-list"></div>
        </div>`;

    panel.append(drawer);
    return panel;
}

function initialize() {
    if (document.getElementById(PANEL_ID)) {
        return;
    }
    const container = document.getElementById('extensions_settings2');
    if (!container) {
        console.error('[主题订阅器] 找不到扩展设置容器。');
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
    document.getElementById('theme-subscriber-refresh').addEventListener('click', loadCatalog);
    resumePendingThemeActivation();
}

if (eventTypes?.APP_READY) {
    ctx.eventSource.on(eventTypes.APP_READY, initialize);
} else {
    $(initialize);
}

console.log('[主题订阅器] 扩展脚本已加载');
