import { FONT_CATALOG } from './font-catalog.js';

const ROOT_ID = 'theme-subscriber-reading';
const STYLE_ID = 'theme-subscriber-reading-font';
const MENU_ID = 'theme-subscriber-reading-menu';
const LOCAL_FONTS = [
    { id: 'theme', label: '跟随主题（恢复原字体）', family: '' },
    { id: 'system', label: '系统字体', family: 'system-ui, sans-serif' },
    { id: 'serif', label: '本机宋体', family: '"Songti SC", SimSun, serif' },
    { id: 'sans', label: '本机黑体', family: '"Microsoft YaHei", "PingFang SC", sans-serif' },
];
const FONTS = [...LOCAL_FONTS, ...FONT_CATALOG];

// All persistent values live under the existing extension settings namespace.
export function mountReadingPreferences({ panel, getSettings, save, currentTheme, themeNames, activate, rememberPrevious, notify }) {
    const root = document.createElement('section');
    root.id = ROOT_ID;
    root.innerHTML = `
        <h4>字体与亮暗切换</h4>
        <label for="theme-subscriber-reading-font-select">阅读字体</label>
        <select id="theme-subscriber-reading-font-select" class="text_pole"></select>
        <p class="reading-sample">月色落在书页上。The moon is bright. 0123456789</p>
        <small>选中即应用于聊天正文、姓名和输入框。远程字体首次加载需要等待；缺少的汉字由系统字体补足。</small>
        <p class="reading-font-status" role="status" aria-live="polite"></p>
        <div class="reading-pair">
            <label>☀ 亮色主题<select class="text_pole" data-theme-binding="light"></select></label>
            <label>☾ 暗色主题<select class="text_pole" data-theme-binding="dark"></select></label>
        </div>
        <small>各选一个已安装主题，以后点一下即可切换。这里不会自动给主题反色；也可以绑定同款主题的两个已安装配色版本。</small>
        <div class="reading-actions">
            <button type="button" class="menu_button" data-reading-mode="light">☀ 切换亮色</button>
            <button type="button" class="menu_button" data-reading-mode="dark">☾ 切换暗色</button>
        </div>
        <p class="reading-mode-status" role="status" aria-live="polite"></p>`;
    panel.querySelector('.inline-drawer-content').prepend(root);
    const abort = new AbortController();
    let disposed = false;
    let generation = 0;
    let loadedFace = null;
    let activeFont = 'theme';
    const fontSelect = root.querySelector('#theme-subscriber-reading-font-select');
    const fontStatus = root.querySelector('.reading-font-status');
    const modeStatus = root.querySelector('.reading-mode-status');
    const sample = root.querySelector('.reading-sample');
    const fontStyle = document.createElement('style');
    fontStyle.id = STYLE_ID;
    document.head.append(fontStyle);

    function settings() {
        const owner = getSettings();
        if (!owner.readingPreferences || typeof owner.readingPreferences !== 'object' || Array.isArray(owner.readingPreferences)) {
            owner.readingPreferences = {};
        }
        const value = owner.readingPreferences;
        if (!FONTS.some(font => font.id === value.font)) value.font = 'theme';
        for (const key of ['light', 'dark']) if (typeof value[key] !== 'string') value[key] = '';
        return value;
    }

    for (const font of FONTS) {
        const option = new Option(font.label, font.id);
        fontSelect.add(option);
    }
    fontSelect.value = settings().font;

    async function selectFont(id, persist) {
        const ticket = ++generation;
        const font = FONTS.find(item => item.id === id) || LOCAL_FONTS[0];
        let nextFace = null;
        try {
            let family = font.family;
            if (font.url) {
                fontStatus.textContent = `正在加载「${font.label}」…`;
                // Only curated immutable font URLs; never user supplied CSS/URLs.
                const alias = `ThemeSubscriber_${font.id.replace(/[^a-z0-9_-]/gi, '_')}`;
                nextFace = new FontFace(alias, `url("${font.url}")`, { weight: font.weight, display: 'swap' });
                let timeout;
                try {
                    await Promise.race([
                        nextFace.load(),
                        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('字体加载超时')), 60000); }),
                    ]);
                } finally {
                    clearTimeout(timeout);
                }
                if (disposed || ticket !== generation) return;
                document.fonts.add(nextFace);
                family = `"${alias}", system-ui, sans-serif`;
            }
            if (disposed || ticket !== generation) return;
            fontStyle.textContent = font.id === 'theme' ? '' : `
html body #chat .mes_text,
html body #chat .mes_text :is(p,q,em,strong,b,i,span,a,h1,h2,h3,h4,h5,h6,li,td,th,blockquote):not(:is(pre,code,kbd,samp) *):not([class*="fa-"]):not(.icon),
html body #chat .name_text,
html body #send_textarea,
html body #chat :is(.edit_textarea,.reasoning_edit_textarea) {
    font-family: ${family} !important;
}`;
            sample.style.fontFamily = family;
            if (loadedFace) document.fonts.delete(loadedFace);
            loadedFace = nextFace;
            activeFont = font.id;
            fontSelect.value = font.id;
            if (persist) { settings().font = font.id; save(); }
            fontStatus.textContent = font.id === 'theme' ? '已恢复主题原字体。' : `已应用「${font.label}」。${font.cjk === 0 ? '此款为西文字体，中文使用系统回退。' : ''}`;
        } catch (error) {
            if (disposed || ticket !== generation) return;
            fontSelect.value = activeFont;
            fontStatus.textContent = `「${font.label}」加载失败，保留原字体。可以重新选择重试。`;
        }
    }

    function switchMode(mode) {
        const prefs = settings();
        const target = prefs[mode];
        if (!target || !themeNames().includes(target) || prefs.light === prefs.dark) {
            modeStatus.textContent = '请先绑定两个不同的已安装主题。';
            refresh();
            return;
        }
        if (target === currentTheme()) return;
        try {
            rememberPrevious(target);
            if (!activate(target)) throw new Error('主题暂时无法切换，请刷新主题列表后重试。');
            refresh();
        } catch (error) {
            modeStatus.textContent = error.message;
            notify('error', error.message);
        }
    }

    function ensureMenu() {
        const host = document.getElementById('extensionsMenu');
        if (!host || host.querySelector(`#${MENU_ID}`)) return;
        const menu = document.createElement('div');
        menu.id = MENU_ID;
        for (const [mode, label] of [['light', '☀ 亮色'], ['dark', '☾ 暗色']]) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'menu_button';
            button.dataset.readingMode = mode;
            button.textContent = label;
            button.addEventListener('click', () => switchMode(mode), { signal: abort.signal });
            menu.append(button);
        }
        host.append(menu);
    }

    function refresh() {
        if (disposed) return;
        ensureMenu();
        const prefs = settings();
        const available = [...new Set(themeNames())];
        const current = currentTheme();
        for (const select of root.querySelectorAll('[data-theme-binding]')) {
            const selected = prefs[select.dataset.themeBinding];
            select.replaceChildren(new Option('请选择已安装主题', ''));
            for (const name of available) select.add(new Option(name, name));
            if (selected && !available.includes(selected)) {
                const missing = new Option(`${selected}（未安装）`, selected);
                missing.disabled = true;
                select.add(missing);
            }
            select.value = selected;
        }
        for (const scope of [root, document.getElementById(MENU_ID)]) {
            for (const button of scope?.querySelectorAll('[data-reading-mode]') || []) {
                const target = prefs[button.dataset.readingMode];
                button.disabled = !target || !available.includes(target) || prefs.light === prefs.dark;
                button.setAttribute('aria-pressed', String(Boolean(target) && target === current));
                button.title = button.disabled ? '请在酒疫主题器中绑定不同的已安装亮色、暗色主题' : `切换到 ${target}`;
            }
        }
        modeStatus.textContent = prefs.light && prefs.light === prefs.dark
            ? '亮色和暗色不能绑定同一个主题。'
            : `当前：${current || '未识别'}。${prefs.light && prefs.dark ? '' : '请先设置亮色和暗色主题。'}`;
    }

    fontSelect.addEventListener('change', () => void selectFont(fontSelect.value, true), { signal: abort.signal });
    for (const select of root.querySelectorAll('[data-theme-binding]')) {
        select.addEventListener('change', () => {
            settings()[select.dataset.themeBinding] = select.value;
            save();
            refresh();
        }, { signal: abort.signal });
    }
    for (const button of root.querySelectorAll('[data-reading-mode]')) {
        button.addEventListener('click', () => switchMode(button.dataset.readingMode), { signal: abort.signal });
    }
    // The host changes themes through jQuery; a native listener alone misses it.
    const onThemeChange = () => refresh();
    $(document).on('change.themeSubscriberReading', '#themes', onThemeChange);
    const observer = new MutationObserver(refresh);
    const themeSelect = document.getElementById('themes');
    if (themeSelect) observer.observe(themeSelect, { childList: true, subtree: true });
    refresh();
    void selectFont(settings().font, false);
    return () => {
        disposed = true;
        generation++;
        abort.abort();
        observer.disconnect();
        $(document).off('change.themeSubscriberReading', '#themes', onThemeChange);
        if (loadedFace) document.fonts.delete(loadedFace);
        fontStyle.remove();
        root.remove();
        document.getElementById(MENU_ID)?.remove();
    };
}
