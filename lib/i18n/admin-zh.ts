/**
 * Admin Panel Chinese Translation Dictionary
 *
 * Extracted accurately from the actual Admin Panel source files:
 * - app/(main)/admin/layout.tsx
 * - app/(main)/admin/login/page.tsx
 * - app/(main)/admin/change-password/page.tsx
 * - app/(main)/admin/_tabs/*.tsx
 *
 * 100% verified against real codebase strings to ensure 0 fictional entries.
 */

export const ADMIN_ZH_DICT: Record<string, string> = {
  // Navigation & Shell (layout.tsx)
  Overview: "概览",
  Dashboard: "控制台",
  Configuration: "配置",
  Settings: "常规设置",
  Branding: "品牌与外观",
  Authentication: "身份认证",
  "Invite Codes": "邀请码",
  Policy: "策略",
  Extensions: "扩展",
  Plugins: "插件",
  Themes: "主题",
  Marketplace: "市场",
  System: "系统",
  Version: "版本",
  Telemetry: "遥测",
  "Audit Log": "审计日志",
  "Change Password": "修改密码",
  "Sign out": "退出登录",
  Admin: "管理",
  Mail: "邮件",
  Calendar: "日历",
  Contacts: "联系人",
  Files: "文件",

  // Login & Password Management (login/page.tsx, change-password/page.tsx)
  "Admin Dashboard": "管理员控制台",
  "Enter your admin password to continue": "输入管理员密码以继续",
  Password: "密码",
  "Enter admin password": "输入管理员密码",
  "Sign in": "登录",
  "Signing in...": "正在登录...",
  "Update your admin password.": "更新您的管理员密码。",
  "Current Password": "当前密码",
  "New Password": "新密码",
  "Confirm New Password": "确认新密码",
  "Changing...": "正在修改...",
  "Password changed. Redirecting...": "密码修改成功，正在跳转...",

  // Dashboard Tab (_tabs/dashboard.tsx)
  Server: "服务器",
  "Application and connection details": "应用程序与连接详情",
  Application: "应用程序",
  "JMAP Server": "JMAP 服务器",
  "Last Login": "上次登录",
  Never: "从不",
  Features: "系统功能",
  "Enabled integrations and modules": "已启用的集成与模块",
  "Admin Panel": "管理面板",
  "Administrative access to server configuration": "服务器配置的管理访问权限",
  "Settings Sync": "设置同步",
  "Synchronize user settings across devices": "跨设备同步用户设置",
  OAuth: "OAuth 认证",
  "OAuth authentication provider": "OAuth 身份认证提供商",
  "Stalwart Integration": "Stalwart 集成",
  "Stalwart mail server features": "Stalwart 邮件服务器特性",
  Accounts: "账户统计",
  "Unique logins recorded over the last 90 days":
    "过去 90 天内记录的独立登录信息",
  "Total accounts": "总账户数",
  "Distinct identities seen in the retention window":
    "保留窗口内见到的独立身份总数",
  "Active in last 7 days": "最近 7 天活跃",
  "Identities with a login in the past week": "过去一周内有登录记录的身份数",
  "Installed plugins, themes, and policy rules": "已安装的插件、主题和策略规则",
  "Policy Rules": "策略规则",
  "Recent Activity": "近期活动",
  "Latest administrative actions": "最新管理操作记录",
  "No activity recorded yet": "暂无任何操作记录",

  // Settings Tab (_tabs/settings.tsx, _tabs/_jmap-servers-section.tsx)
  "Server Settings": "服务器设置",
  "General server configuration": "服务器通用配置",
  "Save changes": "保存更改",
  General: "常规",
  "Application Name": "应用名称",
  "JMAP Server URL": "JMAP 服务器 URL",
  "Allow Custom JMAP Endpoint": "允许自定义 JMAP 端点",
  "Show a JMAP server URL field on the login form, allowing users to connect to any JMAP server":
    "在登录表单中显示 JMAP 服务器 URL 输入框，允许用户连接到任意 JMAP 服务器",
  "Stalwart Features": "Stalwart 特性",
  "Enable Stalwart Mail Server-specific features":
    "启用 Stalwart 邮件服务器专属功能",
  "Demo Mode": "演示模式",
  "Enable demo mode with sample data": "启用带有示例数据的演示模式",
  "Search Engine Indexing": "搜索引擎索引",
  "Allow search engines to index this webmail. Off (the default) sends noindex/nofollow in the page head, recommended for private deployments.":
    "允许搜索引擎索引此网页邮箱。关闭（默认）会在页面头部发送 noindex/nofollow，推荐私有部署保持关闭。",
  "JMAP Servers (multi-server)": "JMAP 服务器（多服务器）",
  "Auto-pick server by email domain": "根据邮箱域名自动匹配服务器",
  "When users type their email, automatically select the matching server from the list below.":
    "当用户输入邮箱时，自动从下方列表中选择匹配的服务器。",
  Servers: "服务器列表",
  "Each entry appears as an option on the login dropdown. Leave the list empty to fall back to the single JMAP Server URL above.":
    "每个条目都会作为选项出现在登录下拉菜单中。留空则回退使用上方的单个 JMAP 服务器 URL。",
  "Add server": "添加服务器",
  "No servers configured.": "未配置多服务器。",
  "Email domains (comma-separated, used for auto-pick)":
    "邮箱域名（逗号分隔，用于自动匹配）",
  "Per-server OAuth (optional, overrides global)":
    "单服务器 OAuth 配置（可选，覆盖全局）",
  "OAuth Client ID": "OAuth 客户端 ID",
  "OAuth Issuer URL": "OAuth 发行方 URL",
  "OAuth Client Secret": "OAuth 客户端密钥",
  Logging: "日志记录",
  "Log Format": "日志格式",
  "Log Level": "日志级别",
  "Settings Sync Enabled": "开启设置同步",
  "Requires SESSION_SECRET to be set": "需要设置 SESSION_SECRET 环境变量",
  "CORS warning:": "跨域 (CORS) 警告：",
  "External JMAP servers must include this domain in their CORS":
    "外部 JMAP 服务器必须在其 CORS 响应头中包含此域名：",
  "header, or requests from the browser will be blocked.":
    "，否则来自浏览器的请求将被拦截。",
  "Each JMAP server must allow this webmail's origin in its":
    "每个 JMAP 服务器都必须在其响应头中允许此 Webmail 的源地址：",
  "header, or browser requests will be blocked.": "，否则浏览器请求将被拦截。",
  "Each entry appears as an option on the login dropdown. Leave the list empty to fall back to the single":
    "每个条目都会作为选项出现在登录下拉菜单中。留空则回退使用上方的单个",
  "above.": "（默认）。",

  // Branding Tab (_tabs/branding.tsx)
  "Customize logos, favicon, and company information":
    "自定义图标、Favicon 与公司信息",
  Scope: "生效范围",
  Default: "默认",
  "Add domain": "添加域名",
  "Remove domain": "移除域名",
  "Editing the Default branding. Add a domain to override branding when the webmail is served on a specific hostname.":
    "修改默认品牌。在一个特定的主机名上部署 ldqmail 时添加一个域名以重写品牌",
  "Images & Logos": "图片与图标",
  "Upload a file or enter a URL. Supported formats: SVG, PNG, JPEG, WebP, ICO (max 2 MB)":
    "上传文件或输入 URL。支持格式：SVG、PNG、JPEG、WebP、ICO（最大 2 MB）",
  Favicon: "Favicon 图标",
  "App Logo (Light Mode)": "应用 Logo（浅色模式）",
  "App Logo (Dark Mode)": "应用 Logo（深色模式）",
  "Login Logo (Light Mode)": "登录页 Logo（浅色模式）",
  "Login Logo (Dark Mode)": "登录页 Logo（深色模式）",
  "Progressive Web App": "渐进式 Web 应用 (PWA)",
  "Shown when users install the webmail to their home screen. Leave fields blank to fall back to the favicon and app name.":
    "当用户将网页邮箱安装到主屏幕时显示。留空则回退使用 Favicon 和应用名称。",
  "PWA Icon": "PWA 图标",
  "PWA Screenshot (Mobile)": "PWA 预览截图（移动端）",
  "PWA Screenshot (Desktop)": "PWA 预览截图（桌面端）",
  "Short Name": "应用短名称",
  Description: "应用描述",
  "Theme Color": "主题颜色",
  "Background Color": "背景颜色",
  "Company Information": "公司与法律信息",
  "Company Name": "公司名称",
  "Imprint URL": "版本/法律说明 URL",
  "Privacy Policy URL": "隐私政策 URL",
  "Company Website URL": "公司官网 URL",

  // Authentication Tab (_tabs/auth.tsx)
  "OAuth, SSO, and session configuration": "OAuth、SSO 与会话安全配置",
  "Auto-configure OAuth (Stalwart)": "自动配置 OAuth (Stalwart)",
  "Registers an OAuth client on the connected Stalwart server, generates a client secret, and saves the settings here. Requires your Stalwart account to have admin permissions.":
    "在已连接的 Stalwart 服务器上自动注册 OAuth 客户端、生成客户端密钥并保存到此处。需要您的 Stalwart 账户拥有管理员权限。",
  "Set up automagically": "一键自动配置",
  "Auto-configure OAuth": "自动配置 OAuth",
  "Verify the URLs below before continuing. The webmail and Stalwart can live on different domains.":
    "在继续前请核对以下 URL。网页邮箱与 Stalwart 可以部署在不同域名下。",
  "Webmail origin": "Webmail 站点源地址 (Origin)",
  "Stalwart issuer URL": "Stalwart 发行方 URL",
  "Also enable “OAuth only” (hide password login)":
    "同时启用“仅限 OAuth”（隐藏密码登录表单）",
  "OAuth / OpenID Connect": "OAuth / OpenID Connect",
  "OAuth Enabled": "启用 OAuth",
  "OAuth Only": "仅限 OAuth",
  "Hide password login form when enabled": "启用后隐藏常规密码登录表单",
  "Allow private OAuth endpoints": "允许私有内网 OAuth 端点",
  "Permit discovery to resolve to RFC-1918 / loopback hosts. Enable only for split-DNS deployments where the mail server's public hostname resolves to an internal IP.":
    "允许发现端点解析到 RFC-1918 私有 IP / 回环地址。仅在邮件服务器公网域名解析到内网 IP 的 Split-DNS 环境下启用。",
  "OAuth Scopes": "OAuth 作用域 (Scopes)",
  "Space-separated scopes that replace the defaults. Leave blank to use the built-in scope list.":
    "空格分隔的作用域列表，会替换默认值。留空则使用内置作用域列表。",
  "OAuth Extra Scopes": "OAuth 额外作用域",
  "Additional space-separated scopes appended to the defaults.":
    "追加到默认作用域后面的额外空格分隔作用域。",
  "Single Sign-On": "单点登录 (SSO)",
  "Auto SSO": "自动 SSO 跳转",
  "Automatically redirect to SSO provider on load":
    "页面加载时自动重定向到 SSO 登录提供商",
  "Stalwart admin access": "Stalwart 管理员权限",
  "What a Stalwart admin account grants in this dashboard. “Automatic” signs Stalwart admins in without the admin password; “Password required” keeps the shield but asks for the admin password; “Off” ignores Stalwart admin status entirely. The last two need an admin password to be configured.":
    "授予 Stalwart 管理员账号在管理面板中的权限。选择“自动”时无需管理员密码即可登录；选择“需要密码”时会要求输入管理员密码；选择“关闭”会完全无视管理员身份。选择后两项需要配置管理员密码。",
  "Automatic (no password)": "自动（无需密码）",
  "Password required": "需要密码",
  "Off (separate admins)": "关闭（独立管理员）",
  "Session & Security": "会话与安全",
  "Cookie SameSite": "Cookie SameSite 策略",
  "Allowed Frame Ancestors": "允许的嵌入框架源 (Frame Ancestors)",
  "Parent Origin": "父级窗口 Origin",
  "For embedded mode communication": "用于嵌入式 iframe 模式下的跨域通信",

  // Invites Tab (_tabs/invites.tsx)
  "Registration Invite Codes": "注册邀请码",
  "Generate and manage invite codes required for new user account registration.":
    "生成并管理新用户注册所需的邀请码。",
  "Generate Invite Code": "生成邀请码",
  "Total Codes": "邀请码总数",
  "Active Codes": "生效中的邀请码",
  "Registered Users": "已注册用户数",
  "Invite Code": "邀请码",
  Usage: "使用情况",
  Expiration: "过期时间",
  Note: "备注",
  Created: "创建时间",
  Revoked: "已作废",
  Expired: "已过期",
  "Used Up": "已用尽",
  Active: "生效中",
  "Usage Logs": "使用日志",
  "Custom Code (Optional)": "自定义邀请码（可选）",
  "Max Uses": "最大使用次数",
  "Note / Remark": "备注说明",
  "Generate Code": "立即生成",
  "1 time (Single-use)": "1 次 (单次有效)",
  "5 times": "5 次",
  "10 times": "10 次",
  "Unlimited (0)": "无限制 (0)",
  "7 days": "7 天",
  "30 days": "30 天",
  "90 days": "90 天",
  "Never expire": "永不过期",
  "No registrations with this code yet.": "暂无用户使用此邀请码注册。",
  'No invite codes generated yet. Click "Generate Invite Code" to create one.':
    "暂无已生成的邀请码。点击“生成邀请码”即可生成。",

  // Policy Tab (_tabs/policy.tsx)
  "User Policy": "用户策略",
  "Control which features and settings users can access":
    "控制用户可以访问的功能与设置项",
  "Save policy": "保存策略",
  "Feature Gates": "功能开关",
  "Toggle entire features on or off for all users. Plugin and theme gates are on their respective admin pages.":
    "为所有用户统一开启或关闭特定功能。插件与主题开关位于各自的管理页面中。",
  "Sidebar Apps": "侧边栏小应用",
  "Allow custom web apps in navigation rail":
    "允许在导航栏中添加自定义网页应用",
  "Settings Export/Import": "设置导出/导入",
  "Allow users to export and import settings JSON":
    "允许用户导出和导入设置 JSON 文件",
  "Custom Keywords": "自定义标签/关键词",
  "Allow user-created labels and tags": "允许用户创建自定义标签与标记",
  "Email Templates": "邮件模板",
  "Allow email template creation and library": "允许创建邮件模板和使用模板库",
  "Enable calendar features and views": "启用日历功能和视图",
  "Calendar Tasks": "日历任务",
  "Show task panel in calendar view": "在日历视图中显示待办任务面板",
  "Enable contacts/address book features": "启用通讯录与联系人功能",
  "S/MIME": "S/MIME 邮件加密",
  "Enable certificate management and email signing":
    "启用证书管理与邮件数字签名",
  "External Content": "外部引用内容",
  "Allow users to choose external content loading policy":
    "允许用户自行选择外部图片/内容的加载策略",
  "Debug Mode": "调试模式",
  "Allow users to enable debug/diagnostic mode": "允许用户启用调试与诊断模式",
  "Folder Icons": "文件夹图标",
  "Allow custom folder icon picker": "允许用户自定义文件夹图标",
  "Hover Actions Config": "悬浮快捷操作配置",
  "Allow users to customize email hover actions":
    "允许用户自定义邮件列表条目的悬停操作按钮",
  "Files (WebDAV)": "文件存储 (WebDAV)",
  "Enable file storage via WebDAV. WARNING: Large uploads can cause Stalwart/RocksDB instability. Not recommended for production.":
    "启用基于 WebDAV 的文件存储。警告：上传大文件会导致 Stalwart 及其内置的 RocksDB 变得不稳定。生产环境不建议开启",
  "Unified Mailbox: Unread": "统一收件箱：未读",
  "Allow an \"Unread\" entry in the Unified Mailbox section that lists unread mail across the account and its shared folders (or every account when the cross-account sub-option is on). Honors the user's folder selection. Requires the matching per-user toggle in Settings → Appearance.":
    "允许在统一收件箱区域显示“未读”条目，列出当前账户及其共享文件夹中的所有未读邮件（若开启跨账户子选项，则跨所有已登录账户汇总）。遵循用户的文件夹选择，需在“设置 → 外观”中开启对应开关。",
  "Unified Mailbox: Starred": "统一收件箱：已加星标",
  "Allow a \"Starred\" entry in the Unified Mailbox section that lists flagged/starred mail across the account and its shared folders (or every account when the cross-account sub-option is on). Honors the user's folder selection. Requires the matching per-user toggle in Settings → Appearance.":
    "允许在统一收件箱区域显示“星标”条目，列出当前账户及其共享文件夹中的所有标记/星标邮件（若开启跨账户子选项，则跨所有已登录账户汇总）。遵循用户的文件夹选择，需在“设置 → 外观”中开启对应开关。",
  "Unified Mailbox: All Mail": "统一收件箱：所有邮件",
  "Allow an \"All mail\" entry in the Unified Mailbox section that lists all mail across the account and its shared folders (or every account when the cross-account sub-option is on). Honors the user's folder selection. Requires the matching per-user toggle in Settings → Appearance.":
    "允许在统一收件箱区域显示“所有邮件”条目，列出当前账户及其共享文件夹中的所有邮件（若开启跨账户子选项，则跨所有已登录账户汇总）。遵循用户的文件夹选择，需在“设置 → 外观”中开启对应开关。",
  "Unified Mailbox: Cross-account": "统一收件箱：跨账户聚合",
  "Allow users to expand the Unified Mailbox beyond the active account boundary so its lists merge across every logged-in account. When off, the Unified Mailbox stays within the active account and its shared folders.":
    "允许用户将统一收件箱的范围扩展至当前活动账户之外，将所有已登录账户的邮件合并展示。关闭时，统一收件箱仅聚合当前活动账户及其共享文件夹。",
  "Push Relays": "后台通知推送服务器",
  "Relays users can pick from in notification settings. The built-in Bulwark relay is always offered; add your own here. Users choose from this list - they cannot enter a URL.":
    "用户可在通知设置中选择的推送服务器。内置 LDQ Mail 推送服务器始终提供；你可以在此处添加自定义推送服务器。用户只能从此列表中选择，不能自行输入 URL。",
  Relays: "推送服务器",
  "Mark one as the default. Relays without a valid URL are not offered to users.":
    "设置默认推送服务器。不合法的 URL 无法使用",
  "Bulwark relay": "LDQ Mail 推送服务器",
  "built-in": "内置",
  "Add relay": "添加推送服务器",
  "Lock - users are pinned to the default relay":
    "锁定 - 强制用户只能使用默认推送服务器",
  Appearance: "外观",
  "Font Size": "字体大小",
  Density: "界面密度",
  Animations: "动画效果",
  Email: "邮件",
  "Mark as Read Delay": "标记已读延迟",
  "Delete Action": "删除行为",
  "Show Preview": "显示邮件预览",
  "Mail Layout": "邮件布局",
  "Emails Per Page": "每页邮件数",
  "External Content Policy": "外部内容策略",
  Composer: "撰写",
  "Send Confirmation": "发送前二次确认",
  "Default Reply Mode": "默认回复模式",
  "Auto-select Reply Identity": "自动选择回复发件身份",
  "Plain Text Only": "仅纯文本模式",
  Privacy: "隐私",
  "Session Timeout": "会话超时时长",
  Notifications: "通知",
  "Email Notifications": "邮件通知",
  "Calendar Notifications": "日历通知",
  Advanced: "高级",
  Lock: "锁定",
  Hide: "隐藏",

  // Plugins Tab (_tabs/plugins.tsx)
  "Manage plugins and plugin policy for all users":
    "管理所有用户的插件与插件策略",
  "Save Policy": "保存策略",
  "Upload Plugin": "上传插件",
  "Plugin Policy": "插件策略",
  "Control plugin availability for users": "控制用户是否可以使用插件",
  "Plugins Enabled": "启用插件系统",
  "Allow the plugin system to load and run plugins for users":
    "允许插件系统为用户加载并运行插件",
  "User Plugin Uploads": "允许用户上传插件",
  "Allow users to upload plugin ZIP files in Settings":
    "允许用户在个人设置中自行上传插件 ZIP 包",
  "Require Admin Approval": "需要管理员审核",
  "User-uploaded plugins must be approved by an admin before they can be enabled":
    "用户上传的插件必须经过管理员批准后才能启用",
  "Deployed Plugins": "已安装插件",
  "Admin-uploaded plugins for all users": "管理员为所有用户上传的插件",
  "No plugins installed": "没有已安装的插件",
  "Upload a plugin ZIP file to get started":
    "上传一个插件压缩文件（ZIP）开始使用",

  // Themes Tab (_tabs/themes.tsx)
  "Manage themes and theme policy for all users":
    "管理所有用户的主题和主题策略",
  "Upload Theme": "上传主题",
  "Theme Policy": "主题策略",
  "Control theme availability and defaults for users":
    "设置主题可用性以及所有用户的默认主题",
  "Themes Enabled": "启用主题",
  "Allow users to select and apply themes": "允许用户选择并应用主题",
  "User Theme Uploads": "用户上传主题",
  "Allow users to upload their own theme files": "允许用户上传自己的主题文件",
  "Default Theme": "默认主题",
  "Theme applied when users have not chosen one":
    "用户尚未选择主题时的默认主题",
  "System Default": "系统默认",
  "Built-in": "内置",
  "Built-in Themes": "内置主题",
  "Deployed Themes": "已安装主题",
  "Admin-uploaded themes available to all users":
    "管理员上传的主题，所有用户可用",
  "No themes installed": "没有已安装的主题",
  "Upload a theme ZIP file to get started":
    "上传一个主题压缩文件（ZIP）开始使用",

  // Marketplace Tab (_tabs/marketplace.tsx)
  "Browse and install plugins and themes from the BulwarkMail extension directory":
    "在 BulwarkMail 拓展市场浏览并安装插件和主题",
  All: "全部",
  "Not authenticated": "没有权限",
  "Start the extension directory server on the configured port": "在配置的端口上启动拓展市场服务器",
  Retry: "重试",

  // Version Tab (_tabs/version.tsx)
  "Hourly check against the Bulwark version server. Severity is decided server-side and disable with BULWARK_UPDATE_CHECK=off.":
    "每小时与 Bulwark 版本服务器进行比对检查。严重程度由服务端判定，可通过 BULWARK_UPDATE_CHECK=off 禁用。",
  "disable with": "可通过以下配置禁用：",
  "Check now": "立即检查",
  Severity: "安全等级",
  Running: "当前运行版本",
  "Latest release": "最新发布版本",
  Advisory: "安全通告",
  Schedule: "检查计划",
  "Last checked": "上次检查时间",
  "Last success": "上次成功检查",
  "Next scheduled": "下次计划检查",
  "Server timestamp": "服务器时间戳",
  Source: "更新源",
  Endpoint: "检查端点",
  "Disabled by env": "已被环境变量禁用",
  "Security update": "安全更新",
  Deprecated: "已弃用",
  "Update available": "有可用更新",
  "Up to date": "已是最新版本",
  "Where Stalwart serves": "Stalwart 服务提供地址：",
  "Saved as": "，保存为",
  "Pre-filled from your JMAP server URL.":
    "（已根据您的 JMAP 服务器 URL 自动预填）。",
  "Locked by": "已被环境变量锁定：",
  "env var.": "环境变量。",

  // Telemetry Tab (_tabs/telemetry.tsx)
  "Anonymous Usage Stats": "匿名使用统计",
  Enable: "启用",
  Disable: "禁用",
  "Last sent": "上次发送时间",
  "Consented at": "授权同意时间",
  "Account activity": "账户活跃度",
  "Total (90d)": "总账户 (90天)",
  "Active (7d)": "活跃账户 (7天)",
  "Payload preview": "数据报文预览",
  "Send now": "立即发送",

  // Logs Tab (_tabs/logs.tsx)
  "All actions": "所有操作行为",
  Login: "管理员登录",
  Logout: "管理员退出",
  "Login Failed": "登录失败",
  "Login Blocked": "登录被拦截",
  "Password Change": "密码修改",
  "Config Update": "配置更新",
  "Config Revert": "配置重置",
  "Policy Update": "策略更新",
  "No entries found": "未找到日志条目",
  Time: "时间",
  Action: "操作",
  Details: "详情",
  IP: "IP 地址",
  Previous: "上一页",
  Next: "下一页",

  // Common UI Actions & State Strings
  "Loading...": "加载中...",
  Refresh: "刷新",
  Save: "保存",
  Cancel: "取消",
  Add: "添加",
  Edit: "编辑",
  Delete: "删除",
  Close: "关闭",
  Actions: "操作",
  Status: "状态",
  Search: "搜索",
  Yes: "是",
  No: "否",

  // Input Placeholders
  "••••••••  (saved - type to replace)": "•••••••• (已保存 - 输入以替换)",
  "••••••••  (unchanged)": "•••••••• (未修改)",
  "Enter URL (uploads only for default scope)":
    "输入 URL（仅默认范围支持上传）",
  "Enter URL or upload a file": "输入 URL 或上传文件",
  "Shown on home screen (max ~12 chars)": "显示在主屏幕上（最多约12个字符）",
  "App description for install prompts": "安装提示中显示的应用描述",
  "Enter value": "输入内容",
  "e.g. INV-VIP-2026 (Leave empty to auto-generate)":
    "例如 INV-VIP-2026（留空将自动生成）",
  "e.g. Created for Team Member A": "例如 为团队成员 A 创建",
  "Search extensions...": "搜索扩展程序...",
  "Company relay": "企业中继",
  "Main server": "主服务器",
  "mail.example.com or *.example.com": "mail.example.com 或 *.example.com",
};
