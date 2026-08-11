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
    const byFileName = new Map();
    for (const source of sources) {
        const entries = await readdir(source.directory, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.json') {
                continue;
            }
            const fullPath = path.join(source.directory, entry.name);
            const fileStat = await stat(fullPath);
            byFileName.set(entry.name, { ...source, fileName: entry.name, fullPath, modifiedAt: fileStat.mtime });
        }
    }
    return [...byFileName.values()].sort((a, b) => a.fileName.localeCompare(b.fileName, 'zh-CN'));
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
        const versions = parsed.schema_version === 2 && Array.isArray(theme.versions)
            ? theme.versions
            : [{
                version: theme.version,
                theme_url: theme.theme_url,
                sha256: theme.sha256,
                minimum_client_version: theme.minimum_client_version,
                updated_at: theme.updated_at,
            }];
        return {
            id: theme.id,
            name: theme.name,
            display_name: theme.display_name || theme.name,
            description: theme.description || '',
            preview_url: theme.preview_url || undefined,
            appearance: theme.appearance === 'light' ? 'light' : 'dark',
            latest_version: theme.latest_version || versions[0]?.version || '',
            default_version: theme.default_version || theme.latest_version || versions[0]?.version || '',
            versions: versions.filter(version => version?.version && version?.theme_url && version?.sha256),
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
        return {
            version: versionFromDate(file.modifiedAt),
            version_name: String(versionMetadata.name || '').trim(),
            changelog: String(versionMetadata.changelog || '').trim(),
            theme_url: remoteUrl(file.fileName, commit || 'main'),
            theme_name: file.themeName,
            sha256: hash,
            minimum_client_version: minimumClientVersion,
            updated_at: file.modifiedAt.toISOString(),
            status: file.status,
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

    const themesByName = new Map(existingThemes.map(theme => [theme.name, theme]));
    for (const [themeName, candidates] of candidatesByName) {
        const selectedFile = selectedByName.get(themeName);
        const existing = themesByName.get(themeName);
        const themeMetadata = metadata.themes?.[themeName] || {};
        const id = existing?.id || `theme-${sha256(Buffer.from(themeName, 'utf8')).slice(0, 16)}`;
        const versions = addDefaultVersionMetadata(mergeVersions(existing?.versions || [], candidates));
        const selectedVersion = versionFromDate(selectedFile.modifiedAt);
        const selectedCandidate = candidates.find(version => version.version === selectedVersion);
        const latest = versions.find(version => version.version === selectedVersion)
            || (commit && selectedCandidate ? versions.find(version => version.sha256 === selectedCandidate.sha256) : null)
            || versions[0];
        const defaultCandidate = themeMetadata.default_source_file
            ? versions.find(version => version.source_file === themeMetadata.default_source_file)
            : null;
        const defaultVersion = defaultCandidate?.version || latest.version;
        themesByName.set(themeName, {
            id,
            name: themeName,
            display_name: String(themeMetadata.display_name || existing?.display_name || themeName).slice(0, 128),
            description: selectedFile.status === 'test'
                ? '当前测试中主题，可远程安装、更新和切换任意保留版本。'
                : '已完成主题，可远程安装、更新和切换任意保留版本。',
            ...(existing?.preview_url ? { preview_url: existing.preview_url } : {}),
            appearance: themeMetadata.appearance || candidates[0]?.appearance || existing?.appearance || 'dark',
            latest_version: latest.version,
            default_version: defaultVersion,
            versions,
        });
    }

    const themes = [...themesByName.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

    const catalog = {
        schema_version: 2,
        name: 'Zeya 酒馆主题库',
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
    }, null, 2));
}

await main();
