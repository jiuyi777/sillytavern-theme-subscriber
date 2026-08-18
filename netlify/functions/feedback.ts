import type { Config, Context } from '@netlify/functions';

const OWNER = 'jiuyi777';
const REPOSITORY = 'sillytavern-theme-subscriber';
const ALLOWED_TYPES = new Set(['功能建议', '主题显示问题', '希望增加日间或夜间模式', '其他反馈']);

function json(value: unknown, status = 200) {
    return new Response(JSON.stringify(value), {
        status,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'content-type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Cache-Control': 'no-store',
            'Content-Type': 'application/json; charset=utf-8',
        },
    });
}

function clean(value: unknown, maxLength: number) {
    return String(value ?? '').replace(/\0/g, '').trim().slice(0, maxLength);
}

export default async (request: Request, context: Context) => {
    if (request.method === 'OPTIONS') return json({ ok: true });
    if (request.method !== 'POST') return json({ message: '仅支持 POST' }, 405);

    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 16_384) return json({ message: '反馈内容过长' }, 413);

    let input: Record<string, unknown>;
    try {
        input = await request.json();
    } catch {
        return json({ message: '反馈格式无效' }, 400);
    }

    const theme = clean(input.theme, 128) || '酒疫主题器（通用功能）';
    const type = clean(input.type, 40);
    const message = clean(input.message, 3000);
    const device = clean(input.device, 120) || '未填写';
    const source = clean(input.source, 40) || '酒疫主题器';
    if (!ALLOWED_TYPES.has(type)) return json({ message: '反馈类型无效' }, 400);
    if (message.length < 2) return json({ message: '请填写具体反馈内容' }, 400);

    const token = Netlify.env.get('GITHUB_ISSUES_TOKEN');
    if (!token) return json({ message: '反馈服务尚未完成服务端配置' }, 503);

    const body = [
        '### 主题', theme, '',
        '### 反馈类型', type, '',
        '### 希望增加或修改的内容', message, '',
        '### 设备 / SillyTavern 版本（可选）', device, '',
        `> 来源：${source}；请求编号：${context.requestId}`,
        '> 此 Issue 只包含玩家在反馈表单中主动填写的内容。',
    ].join('\n');
    const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPOSITORY}/issues`, {
        method: 'POST',
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'jiuyi-theme-feedback-relay',
            'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ title: `[玩家反馈][${type}] ${theme}`, body }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        console.error('GitHub issue creation failed', response.status, context.requestId);
        return json({ message: 'GitHub 暂时没有接收这条反馈' }, 502);
    }
    return json({ ok: true, issueNumber: result.number });
};

export const config: Config = {
    path: '/api/feedback',
};
