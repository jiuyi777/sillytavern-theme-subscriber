# SillyTavern 主题订阅器

作者：Zeya  
当前版本：0.2.1  
最低 SillyTavern 版本：1.14.0

## 功能

- 从受信任的 GitHub、GitHub Pages 或 jsDelivr HTTPS 地址读取主题目录。
- 在 SillyTavern 扩展设置中显示主题、版本、说明和预览图。
- 安装或更新前校验目录声明的 SHA-256。
- 点击一次即可安装或更新主题、自动刷新并切换。
- 主题包含的远程图片、字体和 `@import` 会随主题加载，并在控制台留下资源提示。
- 通过 SillyTavern 原生 `/api/themes/save` 接口保存主题。
- 不会后台静默覆盖主题，也不会读取聊天、密钥或私人设置。

## 本地安装

### 推荐：使用 SillyTavern 扩展安装器

打开 SillyTavern 的“扩展”页面，在“安装扩展”中粘贴：

```text
https://github.com/jiuyi777/sillytavern-theme-subscriber
```

安装后刷新 SillyTavern。通过仓库地址安装的版本可以使用 SillyTavern 原生扩展更新功能。

### 手动安装

将整个目录放入：

```text
SillyTavern/data/default-user/extensions/theme-subscriber/
```

然后重启或刷新 SillyTavern。在“扩展”设置中打开“GitHub 主题订阅器”。

## 使用

1. 填写远程 `catalog.json` 地址。
2. 点击“检查更新”。
3. 点击目标主题的“安装并切换”“更新并切换”或“切换”。
4. 新安装或更新时酒馆会自动刷新并启用目标主题，无需手动导入文件。

默认目录地址为：

```text
https://api.github.com/repos/jiuyi777/sillytavern-theme-assets/contents/assets/%E5%9C%A8%E7%BA%BF%E4%B8%BB%E9%A2%98%E5%BA%93/catalog.json?ref=main
```

当前目录已经发布33个主题 JSON，插件展示32个内部名称唯一的可安装主题。
目录通过 GitHub Contents API 始终读取 `main` 最新版本；每个主题文件仍使用固定提交地址和 SHA-256，避免缓存或更新过程中的内容错配。

## 常用操作

- 第一次使用：打开“扩展 → GitHub 主题订阅器”，点击“检查更新”。
- 首次安装：点击“安装并切换”，插件校验并保存主题后自动刷新和启用。
- 已安装主题：点击“切换”即可直接启用。
- 远程主题有新版本：按钮会显示“更新并切换”。
- 更换主题库：在“主题目录地址”中填写另一个受信任的 GitHub、GitHub Pages 或 jsDelivr HTTPS 目录。

## 更新插件

- 通过 GitHub 仓库地址安装：在 SillyTavern 第三方扩展管理中执行更新。
- 手动安装：下载仓库最新版并覆盖 `theme-subscriber` 文件夹，然后刷新 SillyTavern。

## 常见问题

- 看不到插件：确认目录内直接存在 `manifest.json`，不要多套一层文件夹，然后刷新酒馆。
- 检查更新失败：确认设备能够访问 `api.github.com`，稍后重试；插件不会因此修改现有主题。
- 安装时提示 SHA-256 不一致：远程文件与目录版本不同，插件会主动停止，不要绕过校验。
- 安装完成但没有切换：刷新一次酒馆，再从原生主题列表选择目标主题。
- 同名主题：SillyTavern 按主题内部 `name` 保存；在线目录只展示每个内部名称的最新版本。

## 隐私与安全

- 插件不读取聊天、API 密钥、Cookie 或私人设置内容。
- 只向当前 SillyTavern 的原生主题保存接口写入用户点击安装的主题。
- 不静默安装主题；用户点击主题按钮才会发生写入和切换。
- 主题远程字体、图片和 `@import` 会随主题 CSS 加载。

## 目录格式

参考 `catalog.example.json`。正式目录中的每个主题都必须提供：

- 稳定且唯一的 `id`
- 与主题 JSON 内 `name` 完全一致的 `name`
- `version`
- `theme_url`
- 对主题 JSON 原始字节计算得到的 `sha256`

更新主题时更改 `version`、`sha256` 和远程文件即可。订阅器以 SHA-256 判断是否有更新，不会只相信版本文字。

## 当前证据状态

JavaScript、JSON、在线目录、主题名称与 SHA-256 已做静态检查；尚未启动 SillyTavern 或浏览器进行运行时验证。

## 维护者同步

`scripts/build-online-catalog.mjs` 用于把维护者本机的 `C:\1234` 完成品和 `C:\aaaa` 测试主题合并为在线目录。测试目录中的同名文件优先；所有 JSON 都上传，但内部名称重复时目录只展示优先级更高、更新时间更晚的一个。
