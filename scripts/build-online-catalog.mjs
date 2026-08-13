import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = 'jiuyi777/sillytavern-theme-assets';
const remoteDirectory = 'assets/在线主题库/themes';
const minimumClientVersion = '1.14.0';
const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputRoot = path.join(projectRoot, 'online-catalog');
const outputThemes = path.join(outputRoot, 'themes');
const metadataPath = path.join(projectRoot, 'catalog-metadata.json');
const gitCache = path.join(path.dirname(projectRoot), '.asset-publish');
const commitArgIndex = process.argv.indexOf('--commit');
const commit = commitArgIndex >= 0 ? String(process.argv[commitArgIndex + 1] || '').trim() : '';
const argumentValue = name => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? String(process.argv[index + 1] || '').trim() : '';
};
const sourceArgument = argumentValue('--source');
const descriptionArgument = argumentValue('--description');
const versionNameArgument = argumentValue('--version-name');
const changelogArgument = argumentValue('--changelog');
const migrateExisting = process.argv.includes('--migrate-existing');

if (commit && !/^[0-9a-f]{40}$/i.test(commit)) {
    throw new Error('--commit 必须是 40 位 Git 提交哈希。');
}

const sources = [
    { directory: 'C:\\1234', status: 'complete', priority: 1 },
    { directory: 'C:\\aaaa', status: 'test', priority: 2 },
];

const secretPattern = /(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|"(?:api[_-]?key|cookie|token)"\s*:\s*"[^"\r\n]{8,}")/i;

function sha256(bytes) {
    return createHash('sha256').update(bytes).digest('hex');
}

function versionFromDate(date) {
    return date.toISOString().replace(/[-:T]/g, '.').replace(/\.\d{3}Z$/, '');
}

function remoteUrl(fileName, ref) {
    const encodedPath = remoteDirectory.split('/').map(encodeURIComponent).join('/');
    return `https://raw.githubusercontent.com/${repository}/${ref}/${encodedPath}/${encodeURIComponent(fileName)}`;
}

function parseRgb(value) {
    const input = String(value || '').trim();
    const hex = input.match(/^#([0-9a-f]{6})$/i);
    if (hex) {
        return [0, 2, 4].map(offset => Number.parseInt(hex[1].slice(offset, offset + 2), 16));
    }
    const functional = input.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    return functional ? functional.slice(1, 4).map(Number) : null;
}

function normalizeLogoPalette(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(item => String(item || '').trim().toLowerCase())
        .filter(item => /^#[0-9a-f]{6}$/.test(item)))].slice(0, 5);
}

function inferAppearance(theme) {
    const rgb = parseRgb(theme.blur_tint_color) || parseRgb(theme.chat_tint_color);
    if (rgb) {
        const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
        return luminance >= 0.55 ? 'light' : 'dark';
    }
    const textRgb = parseRgb(theme.main_text_color);
    if (textRgb) {
        const textLuminance = (0.2126 * textRgb[0] + 0.7152 * textRgb[1] + 0.0722 * textRgb[2]) / 255;
        return textLuminance >= 0.6 ? 'dark' : 'light';
    }
    return 'dark';
}

async function collectSourceFiles() {
    if (sourceArgument) {
        const fullPath = path.resolve(sourceArgument);
        const source = sources.find(candidate => path.dirname(fullPath).toLowerCase() === candidate.directory.toLowerCase());
        if (!source) {
            throw new Error('--source 必须是 C:\\aaaa 或 C:\\1234 中的单个 JSON。');
        }
        if (path.extname(fullPath).toLowerCase() !== '.json') {
            throw new Error('--source 只接受 JSON。');
        }
        const fileStat = await stat(fullPath);
        if (!fileStat.isFile()) {
            throw new Error('--source 不是文件。');
        }
        return [{ ...source, fileName: path.basename(fullPath), fullPath, modifiedAt: fileStat.mtime }];
    }
    if (migrateExisting) {
        return [];
    }
    throw new Error('必须使用 --source 指定当前一个主题版本；禁止为单次发布扫描全部主题。');
}

async function inspectTheme(file) {
    const bytes = await readFile(file.fullPath);
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (secretPattern.test(text)) {
        throw new Error(`疑似包含敏感信息：${file.fullPath}`);
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error(`不是有效 JSON：${file.fullPath}`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`主题根节点无效：${file.fullPath}`);
    }
    if (typeof parsed.name !== 'string' || !parsed.name.trim()) {
        throw new Error(`主题缺少 name：${file.fullPath}`);
    }
    if (typeof parsed.custom_css !== 'string') {
        throw new Error(`主题缺少 custom_css：${file.fullPath}`);
    }
    return {
        ...file,
        bytes,
        themeName: parsed.name.trim(),
        author: String(parsed.author || ''),
        appearance: inferAppearance(parsed),
    };
}

async function getPublishedHash(fileName, localBytes) {
    if (!commit) {
        return sha256(localBytes);
    }
    const url = remoteUrl(fileName, commit);
    const repositoryPath = `${remoteDirectory}/${fileName}`;
    try {
        const blob = execFileSync('git', ['-C', gitCache, 'show', `${commit}:${repositoryPath}`], {
            encoding: null,
            maxBuffer: 16 * 1024 * 1024,
            windowsHide: true,
        });
        return sha256(blob);
    } catch (error) {
        console.warn(`Git 缓存读取失败，改用 HTTPS：${fileName} · ${error?.message || String(error)}`);
    }
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            const response = await fetch(url, { headers: { Accept: 'application/json,text/plain;q=0.9' } });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return sha256(new Uint8Array(await response.arrayBuffer()));
        } catch (error) {
            lastError = error;
            if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, attempt * 750));
            }
        }
    }
    throw new Error(`远程主题读取失败：${fileName} · ${lastError?.message || String(lastError)}`);
}

function chooseCatalogEntries(files) {
    const byThemeName = new Map();
    for (const file of files) {
        const current = byThemeName.get(file.themeName);
        const wins = !current
            || file.priority > current.priority
            || (file.priority === current.priority && file.modifiedAt > current.modifiedAt)
            || (file.priority === current.priority
                && file.modifiedAt.getTime() === current.modifiedAt.getTime()
                && file.fileName.localeCompare(current.fileName, 'zh-CN') > 0);
        if (wins) {
            byThemeName.set(file.themeName, file);
        }
    }
    return [...byThemeName.values()].sort((a, b) => a.themeName.localeCompare(b.themeName, 'zh-CN'));
}

function normalizeVersionIds(inputVersions) {
    const aliases = new Map();
    const usedRelease = new Set(inputVersions.filter(version => version.approved && /^0\.\d+$/.test(String(version.version))).map(version => String(version.version)));
    const usedTest = new Set(inputVersions.filter(version => !version.approved && /^test-0\.\d+$/.test(String(version.version))).map(version => String(version.version)));
    let releaseMinor = Math.max(0, ...[...usedRelease].map(version => Number(version.split('.')[1])));
    let testMinor = Math.max(0, ...[...usedTest].map(version => Number(version.split('.')[1])));
    const byAge = [...inputVersions].sort((a, b) => String(a.updated_at || '').localeCompare(String(b.updated_at || '')));
    const replacements = new Map();
    for (const version of byAge) {
        const current = String(version.version || '');
        const expectedPattern = version.approved ? /^0\.\d+$/ : /^test-0\.\d+$/;
        if (expectedPattern.test(current)) {
            continue;
        }
        let replacement;
        if (version.approved) {
            do { releaseMinor += 1; replacement = `0.${releaseMinor}`; } while (usedRelease.has(replacement));
            usedRelease.add(replacement);
        } else {
            do { testMinor += 1; replacement = `test-0.${testMinor}`; } while (usedTest.has(replacement));
            usedTest.add(replacement);
        }
        aliases.set(current, replacement);
        replacements.set(current, {
            ...version,
            version: replacement,
            version_name: version.approved ? `正式版 V${replacement}` : `测试版 ${replacement.replace(/^test-/, '')}`,
        });
    }
    return {
        aliases,
        versions: inputVersions.map(version => replacements.get(String(version.version || '')) || version),
    };
}

async function loadExistingCatalog() {
    let parsed;
    try {
        const raw = await readFile(path.join(outputRoot, 'catalog.json'), 'utf8');
        parsed = JSON.parse(raw);
    } catch (error) {
        if (error?.code === 'ENOENT') {
            try {
                const apiPath = `https://api.github.com/repos/${repository}/contents/${remoteDirectory.split('/').map(encodeURIComponent).join('/').replace(/%2F/gi, '/').replace(/\/themes$/, '')}/catalog.json?ref=main`;
                const response = await fetch(apiPath, { headers: { Accept: 'application/vnd.github+json' } });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const envelope = await response.json();
                parsed = JSON.parse(Buffer.from(String(envelope.content || '').replace(/\s/g, ''), 'base64').toString('utf8'));
            } catch (remoteError) {
                console.warn(`远程旧目录读取失败，将从当前文件重建：${remoteError?.message || String(remoteError)}`);
                return [];
            }
        } else {
            console.warn(`旧目录读取失败，将从当前文件重建：${error?.message || String(error)}`);
            return [];
        }
    }

    if (!parsed || !Array.isArray(parsed.themes)) {
        return [];
    }
    return parsed.themes.map(theme => {
        const rawVersions = parsed.schema_version >= 2 && Array.isArray(theme.versions)
            ? theme.versions
            : [{
                version: theme.version,
                theme_url: theme.theme_url,
                sha256: theme.sha256,
                minimum_client_version: theme.minimum_client_version,
                updated_at: theme.updated_at,
            }];
        const normalized = rawVersions.filter(version => version?.version && version?.theme_url && version?.sha256).map(version => ({
            ...version,
            approved: parsed.schema_version >= 3
                ? version.approved === true
                : parsed.schema_version === 1 || String(version.status || '') === 'complete',
        }));
        const normalizedIds = normalizeVersionIds(normalized);
        const versions = normalizedIds.versions;
        const requestedDefault = normalizedIds.aliases.get(String(theme.default_version || '').trim()) || String(theme.default_version || '').trim();
        const defaultVersion = versions.find(version => version.version === requestedDefault && version.approved)?.version
            || versions.find(version => version.approved)?.version
            || '';
        const requestedLatest = normalizedIds.aliases.get(String(theme.latest_version || '').trim()) || String(theme.latest_version || '').trim();
        const logoUrl = String(theme.logo_url || '').trim();
        return {
            id: theme.id,
            name: theme.name,
            display_name: theme.display_name || theme.name,
            description: theme.description || '',
            ...(logoUrl ? {
                logo_url: logoUrl,
                logo_alt: theme.logo_alt || `${theme.name}主题标识`,
                logo_palette: normalizeLogoPalette(theme.logo_palette),
                logo_subject: theme.logo_subject || '',
                logo_effect: theme.logo_effect || '',
            } : {}),
            preview_url: theme.preview_url || undefined,
            appearance: theme.appearance === 'light' ? 'light' : 'dark',
            latest_version: requestedLatest || versions[0]?.version || '',
            default_version: defaultVersion,
            versions,
        };
    }).filter(theme => theme.id && theme.name && theme.versions.length);
}

function addDefaultVersionMetadata(versions) {
    const chronological = [...versions].sort((a, b) => String(a.updated_at || '').localeCompare(String(b.updated_at || '')));
    return versions.map(version => {
        const position = chronological.findIndex(item => item.version === version.version);
        return {
            ...version,
            version_name: String(version.version_name || (position === 0 ? '初始版本' : `第 ${position} 次更新`)).slice(0, 80),
            changelog: String(version.changelog || (position === 0 ? '首次收录到在线主题库。' : '同步主题文件更新。')).slice(0, 300),
        };
    });
}

function nextVersion(existingVersions, approved) {
    const pattern = approved ? /^(\d+)\.(\d+)$/ : /^test-(\d+)\.(\d+)$/;
    let highestMinor = 0;
    for (const version of existingVersions) {
        const match = String(version.version || '').match(pattern);
        if (match && Number(match[1]) === 0) {
            highestMinor = Math.max(highestMinor, Number(match[2]));
        }
    }
    return `${approved ? '' : 'test-'}0.${highestMinor + 1}`;
}

function mergeVersions(existingVersions, candidates) {
    const merged = [...existingVersions];
    for (const candidate of candidates) {
        const sameVersionIndex = merged.findIndex(version => version.version === candidate.version);
        if (sameVersionIndex >= 0) {
            merged[sameVersionIndex] = candidate;
            continue;
        }
        const sameContent = commit ? merged.find(version => version.sha256 === candidate.sha256) : null;
        if (!sameContent) {
            merged.push(candidate);
        }
    }
    return merged.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
}

async function mapWithConcurrency(items, limit, mapper) {
    const results = new Array(items.length);
    let nextIndex = 0;
    async function worker() {
        while (nextIndex < items.length) {
            const index = nextIndex;
            nextIndex += 1;
            results[index] = await mapper(items[index], index);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
    return results;
}

async function main() {
    const normalizedOutput = path.resolve(outputThemes);
    const normalizedProject = `${path.resolve(projectRoot)}${path.sep}`;
    if (!`${normalizedOutput}${path.sep}`.startsWith(normalizedProject)) {
        throw new Error('输出目录不在插件项目内，已停止。');
    }

    const existingThemes = await loadExistingCatalog();
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
    const sourceFiles = await collectSourceFiles();
    const inspected = [];
    for (const sourceFile of sourceFiles) {
        inspected.push(await inspectTheme(sourceFile));
    }

    await rm(outputThemes, { recursive: true, force: true });
    await mkdir(outputThemes, { recursive: true });
    for (const file of inspected) {
        await copyFile(file.fullPath, path.join(outputThemes, file.fileName));
    }

    const selected = chooseCatalogEntries(inspected);
    const selectedByName = new Map(selected.map(file => [file.themeName, file]));
    const versionCandidates = await mapWithConcurrency(inspected, 6, async file => {
        const hash = await getPublishedHash(file.fileName, file.bytes);
        const themeMetadata = metadata.themes?.[file.themeName] || {};
        const versionMetadata = themeMetadata.versions?.[file.fileName] || {};
        const existingTheme = existingThemes.find(theme => theme.name === file.themeName);
        const approved = versionMetadata.approved === true || (versionMetadata.approved !== false && file.status === 'complete');
        const existingVersion = existingTheme?.versions.find(version => version.sha256 === hash && version.approved === approved);
        const version = existingVersion?.version || nextVersion(existingTheme?.versions || [], approved);
        return {
            version,
            version_name: String(versionNameArgument || versionMetadata.name || (approved ? `正式版 V${version}` : `测试版 ${version.replace(/^test-/, '')}`)).trim(),
            changelog: String(changelogArgument || versionMetadata.changelog || (approved ? '首次正式公开版本。' : '同步当前测试阶段版本，等待用户确认。')).trim(),
            theme_url: remoteUrl(file.fileName, commit || 'main'),
            theme_name: file.themeName,
            sha256: hash,
            minimum_client_version: minimumClientVersion,
            updated_at: file.modifiedAt.toISOString(),
            status: approved ? 'release' : 'test',
            approved,
            sourceFile: file.fileName,
            appearance: themeMetadata.appearance || file.appearance,
            themeName: file.themeName,
        };
    });

    const candidatesByName = new Map();
    for (const candidate of versionCandidates) {
        const list = candidatesByName.get(candidate.themeName) || [];
        const { themeName, sourceFile, appearance, ...version } = candidate;
        version.source_file = sourceFile;
        version.appearance = appearance;
        list.push(version);
        candidatesByName.set(themeName, list);
    }

    const themesByName = new Map(existingThemes
        .filter(theme => metadata.themes?.[theme.name]?.withdrawn !== true)
        .map(theme => [theme.name, theme]));
    for (const [themeName, candidates] of candidatesByName) {
        const selectedFile = selectedByName.get(themeName);
        const existing = themesByName.get(themeName);
        const themeMetadata = metadata.themes?.[themeName] || {};
        if (themeMetadata.withdrawn === true) {
            console.warn(`主题已撤回，跳过目录发布：${themeName}`);
            themesByName.delete(themeName);
            continue;
        }
        const id = existing?.id || `theme-${sha256(Buffer.from(themeName, 'utf8')).slice(0, 16)}`;
        const versions = addDefaultVersionMetadata(mergeVersions(existing?.versions || [], candidates));
        const selectedCandidate = candidates.find(version => version.source_file === selectedFile.fileName) || candidates[0];
        const latest = versions.find(version => version.sha256 === selectedCandidate?.sha256) || versions[0];
        const defaultCandidate = themeMetadata.default_source_file
            ? versions.find(version => version.source_file === themeMetadata.default_source_file)
            : null;
        const approvedVersions = versions.filter(version => version.approved === true);
        const defaultVersion = (defaultCandidate?.approved ? defaultCandidate.version : null)
            || (existing?.default_version && approvedVersions.find(version => version.version === existing.default_version)?.version)
            || approvedVersions[0]?.version
            || '';
        const logoUrl = String(themeMetadata.logo_url || existing?.logo_url || '').trim();
        const logoPalette = normalizeLogoPalette(themeMetadata.logo_palette || existing?.logo_palette);
        themesByName.set(themeName, {
            id,
            name: themeName,
            display_name: String(themeMetadata.display_name || existing?.display_name || themeName).slice(0, 128),
            description: String(descriptionArgument || themeMetadata.description || existing?.description || `${themeName} 的 SillyTavern 界面主题。`).slice(0, 500),
            ...(logoUrl ? {
                logo_url: logoUrl,
                logo_alt: String(themeMetadata.logo_alt || existing?.logo_alt || `${themeName}主题标识`).slice(0, 160),
                logo_palette: logoPalette,
                logo_subject: String(themeMetadata.logo_subject || existing?.logo_subject || '').slice(0, 120),
                logo_effect: String(themeMetadata.logo_effect || existing?.logo_effect || '').slice(0, 120),
            } : {}),
            ...((themeMetadata.preview_url || existing?.preview_url) ? { preview_url: themeMetadata.preview_url || existing.preview_url } : {}),
            appearance: themeMetadata.appearance || candidates[0]?.appearance || existing?.appearance || 'dark',
            latest_version: latest.version,
            default_version: defaultVersion,
            versions,
        });
    }

    for (const [themeName, theme] of themesByName) {
        const themeMetadata = metadata.themes?.[themeName] || {};
        const logoUrl = String(themeMetadata.logo_url || theme.logo_url || '').trim();
        const previewUrl = String(themeMetadata.preview_url || theme.preview_url || '').trim();
        themesByName.set(themeName, {
            ...theme,
            display_name: String(themeMetadata.display_name || theme.display_name || themeName).slice(0, 128),
            description: String(themeMetadata.description || theme.description || `${themeName} 的 SillyTavern 界面主题。`).slice(0, 500),
            ...(logoUrl ? {
                logo_url: logoUrl,
                logo_alt: String(themeMetadata.logo_alt || theme.logo_alt || `${themeName}主题标识`).slice(0, 160),
                logo_palette: normalizeLogoPalette(themeMetadata.logo_palette || theme.logo_palette),
                logo_subject: String(themeMetadata.logo_subject || theme.logo_subject || '').slice(0, 120),
                logo_effect: String(themeMetadata.logo_effect || theme.logo_effect || '').slice(0, 120),
            } : {}),
            ...(previewUrl ? { preview_url: previewUrl } : {}),
            appearance: themeMetadata.appearance || theme.appearance || 'dark',
        });
    }

    const themes = [...themesByName.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

    const catalog = {
        schema_version: 3,
        name: '酒疫主题器',
        updated_at: new Date().toISOString(),
        themes,
    };
    await mkdir(outputRoot, { recursive: true });
    await writeFile(path.join(outputRoot, 'catalog.json'), `${JSON.stringify(catalog, null, 4)}\n`, 'utf8');

    const duplicateCount = inspected.length - selected.length;
    const versionCount = themes.reduce((total, theme) => total + theme.versions.length, 0);
    console.log(JSON.stringify({
        mode: commit ? 'pinned' : 'provisional',
        commit: commit || 'main',
        uploadedFiles: inspected.length,
        catalogThemes: themes.length,
        catalogVersions: versionCount,
        lightThemes: themes.filter(theme => theme.appearance === 'light').length,
        darkThemes: themes.filter(theme => theme.appearance === 'dark').length,
        duplicateInternalNamesKeptAsVersions: duplicateCount,
        testFiles: inspected.filter(file => file.status === 'test').length,
        completedFiles: inspected.filter(file => file.status === 'complete').length,
        approvedVersions: themes.reduce((total, theme) => total + theme.versions.filter(version => version.approved === true).length, 0),
        hiddenVersions: themes.reduce((total, theme) => total + theme.versions.filter(version => version.approved !== true).length, 0),
    }, null, 2));
}

await main();
