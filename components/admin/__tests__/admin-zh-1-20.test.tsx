import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ADMIN_ZH_DICT } from '@/lib/i18n/admin-zh';
import { ADMIN_PAGES } from '@/lib/admin/admin-nav';
import { AdminI18nProvider } from '@/components/admin/admin-i18n-provider';

describe('Admin 1.20.0 Chinese localization', () => {
  it('has Chinese translations for all 1.20.0 admin pages and sections in ADMIN_PAGES', () => {
    const pages120 = ['org-labels', 'org-proofreading', 'org-calendars', 'org-notices', 'org-devices', 'monitoring'];
    for (const pageId of pages120) {
      const page = ADMIN_PAGES.find((p) => p.id === pageId);
      expect(page).toBeDefined();
      expect(ADMIN_ZH_DICT[page!.label], `Missing translation for page.label: ${page!.label}`).toBeDefined();
      expect(ADMIN_ZH_DICT[page!.description], `Missing translation for page.description: ${page!.description}`).toBeDefined();
      for (const section of page!.sections) {
        expect(ADMIN_ZH_DICT[section.title], `Missing translation for section.title: ${section.title}`).toBeDefined();
      }
    }
  });

  it('translates DOM nodes on the Classification page under AdminI18nProvider', () => {
    render(
      <AdminI18nProvider initialLocale="zh-CN">
        <div>
          <h1>Classification</h1>
          <p>Labels such as Internal or Confidential that users pick when they write, and that arrive with the message</p>
          <div data-testid="warning">
            A label only marks the message. It doesn't make mail meet the VS-NfD handling rules (VSA § 50, § 55): that needs approved IT and BSI-approved encryption. Bulwark's S/MIME and PGP plugins and Stalwart are not BSI-approved products. Anyone can forge a received label, so Bulwark only shows it and never relaxes anything because of it.
          </div>
          <button>Add label</button>
          <span>Default label</span>
          <select data-testid="default-select">
            <option value="">None</option>
          </select>
          <span>Require a label</span>
          <span>Extra header</span>
          <p>Calendar invitations, read receipts, phishing reports and unsubscribe mails go out without a label.</p>
          <a href="#">How labels work</a>
        </div>
      </AdminI18nProvider>
    );

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('密级分类');
    expect(screen.getByText('用户撰写邮件时可选择的分类标签（如内部或机密），并随邮件一同传递')).toBeInTheDocument();
    expect(screen.getByTestId('warning').textContent).toContain('分类标签仅作为邮件标记');
    expect(screen.getByRole('button', { name: '添加标签' })).toBeInTheDocument();
    expect(screen.getByText('默认标签')).toBeInTheDocument();
    expect(screen.getByText('无')).toBeInTheDocument();
    expect(screen.getByText('强制要求选择标签')).toBeInTheDocument();
    expect(screen.getByText('自定义信头')).toBeInTheDocument();
    expect(screen.getByText('日历邀请、已读回执、钓鱼举报和退订邮件发信时不会附带分类标签。')).toBeInTheDocument();
    expect(screen.getByText('了解标签工作机制')).toBeInTheDocument();
  });

  it('translates DOM nodes on Proofreading, Devices, Notices and Calendars pages', () => {
    render(
      <AdminI18nProvider initialLocale="zh-CN">
        <div>
          <h2>Proofreading</h2>
          <p>Off and locked hides the setting. On and required keeps it on in every composer.</p>
          <span>Writing language</span>
          <span>No downloads</span>
          <span>No export</span>
          <span>No printing</span>
          <span>Push without sender and subject</span>
          <span>Watermark</span>
          <span>Offline mode</span>
          <span>Don't let people keep mail on their devices</span>
          <span>Write an announcement</span>
          <span>Trash keeps mail for</span>
          <span>Junk keeps mail for</span>
          <span>Company calendars</span>
          <span>Free/busy sharing</span>
          <span>Out-of-office blocks the calendar</span>
        </div>
      </AdminI18nProvider>
    );

    expect(screen.getByText('拼写校对')).toBeInTheDocument();
    expect(screen.getByText('关闭并锁定将对用户隐藏该选项。开启并强制要求将在所有写信器中始终启用。')).toBeInTheDocument();
    expect(screen.getByText('书写语言')).toBeInTheDocument();
    expect(screen.getByText('禁止下载附件与文件')).toBeInTheDocument();
    expect(screen.getByText('禁止导出邮件')).toBeInTheDocument();
    expect(screen.getByText('禁止打印')).toBeInTheDocument();
    expect(screen.getByText('脱敏推送通知（隐藏发件人与主题）')).toBeInTheDocument();
    expect(screen.getByText('安全水印')).toBeInTheDocument();
    expect(screen.getByText('离线模式')).toBeInTheDocument();
    expect(screen.getByText('禁止在设备上保留邮件（禁用离线模式）')).toBeInTheDocument();
    expect(screen.getByText('撰写全员公告')).toBeInTheDocument();
    expect(screen.getByText('已删除邮件保留天数')).toBeInTheDocument();
    expect(screen.getByText('垃圾邮件保留天数')).toBeInTheDocument();
    expect(screen.getByText('企业日历')).toBeInTheDocument();
    expect(screen.getByText('忙闲状态共享')).toBeInTheDocument();
    expect(screen.getByText('外出状态锁定日历日程')).toBeInTheDocument();
  });

  it('translates calendar notes and small print from uploaded screenshot', () => {
    render(
      <AdminI18nProvider initialLocale="zh-CN">
        <div>
          <p>
            Bulwark Lite has no server: the browser fetches the feed itself, so the feed host must send CORS headers (Access-Control-Allow-Origin), and policy.json is a public file there, so don't put tokens in the addresses. A Lite build without third-party traffic only reaches the mail server: put the feed on the same host as Lite or the mail server.{' '}
            <a href="#">How to set it up</a>
          </p>
          <p>
            Bulwark adds the share to each user's default calendar when they sign in. It only adds: shares users made themselves stay, and a user who removes it gets it back at the next sign-in. It shows in the user's sharing list.
          </p>
          <p>
            Users who only use other apps (CalDAV, phones) and never sign in to Bulwark aren't covered. Users can also share their own free/busy under Settings &gt; Calendar.
          </p>
          <p>
            Looking people up also needs directory queries on in Stalwart (Settings &gt; Files &amp; Sharing &gt; Sharing &gt; Allow Directory Queries).{' '}
            <a href="#">How to set it up</a>
          </p>
          <span>At most 20 company calendars.</span>
          <span>No text in German yet.</span>
        </div>
      </AdminI18nProvider>
    );

    expect(screen.getByText(/Bulwark Lite 为无服务器纯前端架构/)).toBeInTheDocument();
    expect(screen.getByText(/用户登录时，Bulwark 会自动将其默认日历的忙闲共享添加至指定群组/)).toBeInTheDocument();
    expect(screen.getByText(/仅通过其他第三方应用（如 CalDAV 客户端、手机自带日历）/)).toBeInTheDocument();
    expect(screen.getByText(/在系统中检索用户还需要在 Stalwart 中开启目录查询功能/)).toBeInTheDocument();
    expect(screen.getByText('最多可添加 20 个企业日历。')).toBeInTheDocument();
    expect(screen.getByText('暂无 德语 文本。')).toBeInTheDocument();
  });

  it('translates all device policy descriptions concatenated with ENFORCED suffix', () => {
    render(
      <AdminI18nProvider initialLocale="zh-CN">
        <div>
          <p data-testid="desc-downloads">
            Attachments and files open in the preview only: no Download, Download all, Open in new tab, Save to Files, dragging out or saving from the PDF viewer. Covers the Files app too, so Save to Files can’t get around it. In the office editor checked by the server; elsewhere in the browser only.
          </p>
          <p data-testid="desc-export">
            Hides saving a message as .eml, View source, dragging messages out, and exporting a folder or the whole account (mbox, ZIP). Importing mail stays. Contacts (vCard) and events (.ics) can still be exported. In the office editor checked by the server; elsewhere in the browser only.
          </p>
          <p data-testid="desc-print">
            Hides every Print button in mail, calendar and contacts. Ctrl+P and the browser’s menu print a page that says printing is turned off. In the office editor checked by the server; elsewhere in the browser only.
          </p>
          <p data-testid="desc-install">
            Bulwark doesn’t offer to install itself as an app and holds back the browser’s own install banner. The browser’s menu can still install Bulwark. In the browser only.
          </p>
          <p data-testid="desc-push">
            Browser notifications say only “New mail”. The server leaves sender, subject and text out of what it sends to the browser and the push service, also for browsers that still run an old Bulwark. The Bulwark mobile app isn’t covered yet: its notifications still show sender and subject. Checked by the server.
          </p>
          <p data-testid="desc-watermark">
            The user’s address and the date across the message, previews of attachments and files, and every printout. In the office editor checked by the server; elsewhere in the browser only.
          </p>
        </div>
      </AdminI18nProvider>
    );

    expect(screen.getByTestId('desc-downloads').textContent).toContain('附件和文件仅允许在线预览');
    expect(screen.getByTestId('desc-downloads').textContent).toContain('文档协同编辑器由服务端校验，其余界面由浏览器前端管控。');

    expect(screen.getByTestId('desc-export').textContent).toContain('隐藏将邮件另存为 .eml');
    expect(screen.getByTestId('desc-export').textContent).toContain('文档协同编辑器由服务端校验，其余界面由浏览器前端管控。');

    expect(screen.getByTestId('desc-print').textContent).toContain('隐藏邮件、日历和通讯录中的所有“打印”按钮');
    expect(screen.getByTestId('desc-print').textContent).toContain('文档协同编辑器由服务端校验，其余界面由浏览器前端管控。');

    expect(screen.getByTestId('desc-install').textContent).toContain('Bulwark 将不再主动向用户推荐安装为独立应用');
    expect(screen.getByTestId('desc-install').textContent).toContain('仅在浏览器端管控。');

    expect(screen.getByTestId('desc-push').textContent).toContain('浏览器推送通知仅显示“新邮件”');
    expect(screen.getByTestId('desc-push').textContent).toContain('由服务器端强制校验拦截。');

    expect(screen.getByTestId('desc-watermark').textContent).toContain('在邮件正文、附件与文件预览页面以及所有打印输出中');
    expect(screen.getByTestId('desc-watermark').textContent).toContain('文档协同编辑器由服务端校验，其余界面由浏览器前端管控。');
  });
});
