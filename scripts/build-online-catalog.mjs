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
    return { ...file, bytes, themeName: parsed.name.trim(), author: String(parsed.author || '') };
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
    const themes = await mapWithConcurrency(selected, 6, async file => {
        const hash = await getPublishedHash(file.fileName, file.bytes);
        const id = `theme-${sha256(Buffer.from(file.themeName, 'utf8')).slice(0, 16)}`;
        return {
            id,
            name: file.themeName,
            version: versionFromDate(file.modifiedAt),
            description: file.status === 'test'
                ? '当前测试中主题，可远程安装、更新和切换。'
                : '已完成主题，可远程安装、更新和切换。',
            theme_url: remoteUrl(file.fileName, commit || 'main'),
            sha256: hash,
            minimum_client_version: minimumClientVersion,
            updated_at: file.modifiedAt.toISOString(),
        };
    });

    const catalog = {
        schema_version: 1,
        name: 'Zeya 酒馆主题库',
        updated_at: new Date().toISOString(),
        themes,
    };
    await mkdir(outputRoot, { recursive: true });
    await writeFile(path.join(outputRoot, 'catalog.json'), `${JSON.stringify(catalog, null, 4)}\n`, 'utf8');

    const duplicateCount = inspected.length - selected.length;
    console.log(JSON.stringify({
        mode: commit ? 'pinned' : 'provisional',
        commit: commit || 'main',
        uploadedFiles: inspected.length,
        catalogThemes: themes.length,
        duplicateInternalNamesNotListed: duplicateCount,
        testFiles: inspected.filter(file => file.status === 'test').length,
        completedFiles: inspected.filter(file => file.status === 'complete').length,
    }, null, 2));
}

await main();
