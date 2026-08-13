const EXTENSION_KEY = 'theme_subscriber';
const PANEL_ID = 'theme-subscriber-panel';
const PENDING_THEME_KEY = 'theme-subscriber:pending-theme';
const RECOVERY_MENU_CONTAINER_ID = 'theme-subscriber-recovery-wand-container';
const RECOVERY_MENU_ITEM_ID = 'theme-subscriber-recovery-wand-item';
const RECOVERY_SHORTCUT_KEY = 'r';
const LEGACY_CATALOG_URL = 'https://raw.githubusercontent.com/jiuyi777/sillytavern-theme-assets/main/themes/catalog.json';
const RAW_CATALOG_URL = 'https://raw.githubusercontent.com/jiuyi777/sillytavern-theme-assets/main/assets/%E5%9C%A8%E7%BA%BF%E4%B8%BB%E9%A2%98%E5%BA%93/catalog.json';
const PREVIOUS_CATALOG_URL = 'https://raw.githubusercontent.com/jiuyi777/sillytavern-theme-assets/e8f96b7ab7795e1a731c6775a68c9fe82edda135/assets/%E5%9C%A8%E7%BA%BF%E4%B8%BB%E9%A2%98%E5%BA%93/catalog.json';
const PINNED_CATALOG_URL = 'https://raw.githubusercontent.com/jiuyi777/sillytavern-theme-assets/0f5107ad7851b767197eeb65ccf8a219350ac5da/assets/%E5%9C%A8%E7%BA%BF%E4%B8%BB%E9%A2%98%E5%BA%93/catalog.json';
const API_CATALOG_URL = 'https://api.github.com/repos/jiuyi777/sillytavern-theme-assets/contents/assets/%E5%9C%A8%E7%BA%BF%E4%B8%BB%E9%A2%98%E5%BA%93/catalog.json?ref=main';
const DEFAULT_CATALOG_URL = RAW_CATALOG_URL;
const MAX_CATALOG_BYTES = 2 * 1024 * 1024;
const MAX_CATALOG_RESPONSE_BYTES = Math.ceil(MAX_CATALOG_BYTES * 4 / 3) + 64 * 1024;
const MAX_THEME_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 60000;
const FETCH_ATTEMPTS = 2;
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
    previousTheme: '',
    lastBrokenTheme: '',
    recoveryEnabled: false,
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
    const sha256 = String(versionEntry.sha256 || '').trim().toLowerCase();

    if (!version || version.length > 40) {
        throw new Error(`主题“${theme.name}”的版本无效。`);
    }
    if (!SHA256_PATTERN.test(sha256)) {
        throw new Error(`主题“${theme.name}”v${version} 缺少有效 SHA-256，已拒绝不受校验的安装。`);
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
        sha256,
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
        console.error('[主题订阅器] 强制返回失败', error);
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
        console.error('[主题订阅器] 删除坏主题失败', error);
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
    if (installed?.sha256 === entry.sha256) {
        rememberPreviousTheme(entry.themeName);
        if (activateExistingTheme(entry.themeName)) {
            return;
        }
    }

    button.disabled = true;
    button.textContent = '正在下载…';

    try {
        const resource = await fetchResource(entry.themeUrl, MAX_THEME_BYTES, `主题“${entry.name}”`);
        button.textContent = '正在校验…';
        const actualHash = await sha256Hex(resource.bytes);
        if (actualHash !== entry.sha256) {
            throw new Error(`主题“${entry.name}”的 SHA-256 与目录记录不一致，已停止安装。`);
        }

        const theme = validateTheme(parseJson(resource.text, `主题“${entry.name}”`), entry.themeName);
        const warnings = getThemeWarnings(theme);
        if (warnings.length) {
            console.info(`[主题订阅器] “${entry.name}”资源提示：${warnings.join(' ')}`);
        }

        button.textContent = '正在保存…';
        await saveTheme(theme);
        settings.installed[entry.id] = {
            name: entry.themeName,
            version: entry.version,
            versionName: entry.versionName,
            sha256: entry.sha256,
            themeUrl: entry.themeUrl,
            installedAt: new Date().toISOString(),
        };
        ctx.saveSettingsDebounced();
        scheduleThemeActivation(entry.themeName);
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
        meta.textContent = `${selectedVersion.versionName} · ${stateLabel} · SHA-256 ${selectedVersion.sha256.slice(0, 10)}…`;
        updateInstallButton(button, selectedVersion, installed);
    };
    versionSelect.addEventListener('change', refreshSelectedVersion);
    button.addEventListener('click', () => installTheme(selectedVersion, button));
    refreshSelectedVersion();

    wrapper.append(versionRow, changelog, meta, button);
    return wrapper;
}

function createThemeCard(entry, toneIndex, options = {}) {
    const settings = getSettings();
    const installed = settings.installed[entry.id];
    const approvedVersions = entry.versions.filter(item => item.approved);
    const otherVersions = entry.versions.filter(item => !item.approved);
    const showOnlyUnapproved = options.showOnlyUnapproved === true;
    const card = document.createElement('article');
    card.className = 'theme-subscriber-card';
    card.dataset.appearance = entry.appearance;
    card.dataset.tone = String(toneIndex % 5);

    const preview = document.createElement('div');
    preview.className = 'theme-subscriber-preview-shell';
    if (entry.previewUrl) {
        const image = document.createElement('img');
        image.className = 'theme-subscriber-preview';
        image.src = entry.previewUrl;
        image.alt = `${entry.displayName}主题预览`;
        image.loading = 'lazy';
        image.referrerPolicy = 'no-referrer';
        preview.append(image);
    } else {
        const mockWindow = document.createElement('div');
        mockWindow.className = 'theme-subscriber-preview-window';
        mockWindow.setAttribute('aria-hidden', 'true');
        mockWindow.innerHTML = '<span></span><span></span><span></span>';
        preview.append(mockWindow);
    }
    const appearanceLabel = document.createElement('span');
    appearanceLabel.className = 'theme-subscriber-appearance-badge';
    appearanceLabel.textContent = entry.appearance === 'light' ? '日间' : '黑夜';
    preview.append(appearanceLabel);
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
        { appearance: 'light', label: '日间主题' },
        { appearance: 'dark', label: '黑夜主题' },
    ];
    const renderGroup = appearance => {
        const entries = approvedThemes.filter(theme => theme.appearance === appearance);
        const testingOnlyEntries = catalog.themes.filter(theme => theme.appearance === appearance && !theme.versions.some(version => version.approved));
        list.replaceChildren();
        entries.forEach((entry, index) => list.append(createThemeCard(entry, index)));
        if (testingOnlyEntries.length > 0) {
            const testing = document.createElement('details');
            testing.className = 'theme-subscriber-testing-library';
            const summary = document.createElement('summary');
            summary.textContent = `测试主题（${testingOnlyEntries.length}）`;
            const testingList = document.createElement('div');
            testingList.className = 'theme-subscriber-testing-list';
            testingOnlyEntries.forEach((entry, index) => testingList.append(createThemeCard(entry, entries.length + index, { showOnlyUnapproved: true })));
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
        const count = approvedThemes.filter(theme => theme.appearance === group.appearance).length;
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'theme-subscriber-tab';
        tab.dataset.appearance = group.appearance;
        tab.setAttribute('role', 'tab');
        tab.textContent = `${group.label} ${count}`;
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
            <b>主题订阅器</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <div class="theme-subscriber-hero">
                <div>
                    <small class="theme-subscriber-eyebrow">THEME LIBRARY</small>
                    <h3>我的主题库</h3>
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
            <details class="theme-subscriber-connection">
                <summary>主题库连接设置</summary>
                <label for="theme-subscriber-url">主题目录地址</label>
                <div class="theme-subscriber-url-row">
                    <input id="theme-subscriber-url" class="text_pole" type="url" inputmode="url" autocomplete="off" spellcheck="false">
                </div>
                <small>目录默认从 GitHub Raw 读取，并自动尝试 jsDelivr 备用地址；安装前仍会校验 SHA-256。</small>
            </details>
        </div>`;

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

console.log('[主题订阅器] 扩展脚本已加载');
