"use client";

import React, { useEffect } from "react";
import { ADMIN_ZH_DICT } from "@/lib/i18n/admin-zh";

const TRANSLATED_VALUES = new Set(Object.values(ADMIN_ZH_DICT));

// Pre-compute lowercased map for case-insensitive fallback matching
const LOWERCASE_ZH_DICT: Record<string, string> = {};
for (const [k, v] of Object.entries(ADMIN_ZH_DICT)) {
  LOWERCASE_ZH_DICT[k.toLowerCase()] = v;
}

interface AdminI18nProviderProps {
  children: React.ReactNode;
  initialLocale?: string;
}

export function AdminI18nProvider({ children, initialLocale }: AdminI18nProviderProps) {
  useEffect(() => {
    // Determine whether Chinese localization should be enabled
    const htmlLang = typeof document !== "undefined" ? (document.documentElement.lang || "").toLowerCase() : "";
    const cookieLang = typeof document !== "undefined" && (document.cookie.includes("NEXT_LOCALE=zh") || document.cookie.includes("locale=zh"));
    const browserLang = typeof navigator !== "undefined" ? (navigator.language || "").toLowerCase() : "";
    
    let isZh = (initialLocale && initialLocale.startsWith("zh")) ||
      htmlLang.startsWith("zh") ||
      cookieLang ||
      browserLang.startsWith("zh");

    try {
      const stored = localStorage.getItem("locale-storage");
      if (stored && stored.includes('"zh"')) {
        isZh = true;
      }
    } catch {
      // ignore
    }

    if (!isZh) return;

    let isTranslating = false;

    function lookupTranslation(str: string): string | undefined {
      if (!str) return undefined;
      // 1. Direct match
      if (ADMIN_ZH_DICT[str]) return ADMIN_ZH_DICT[str];

      // 2. Normalized curly quotes to straight quotes
      const normalizedQuotes = str.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
      if (ADMIN_ZH_DICT[normalizedQuotes]) return ADMIN_ZH_DICT[normalizedQuotes];

      // 3. Normalized whitespace (collapse multiple spaces & linebreaks)
      const collapsed = str.replace(/\s+/g, ' ').trim();
      if (ADMIN_ZH_DICT[collapsed]) return ADMIN_ZH_DICT[collapsed];

      const collapsedNormalized = normalizedQuotes.replace(/\s+/g, ' ').trim();
      if (ADMIN_ZH_DICT[collapsedNormalized]) return ADMIN_ZH_DICT[collapsedNormalized];

      // 4. Case-insensitive fallback lookup
      const lower = str.toLowerCase();
      if (LOWERCASE_ZH_DICT[lower]) return LOWERCASE_ZH_DICT[lower];

      const lowerCollapsed = collapsedNormalized.toLowerCase();
      if (LOWERCASE_ZH_DICT[lowerCollapsed]) return LOWERCASE_ZH_DICT[lowerCollapsed];

      // 5. Dynamic pattern matching
      let m: RegExpMatchArray | null;
      if ((m = str.match(/^Roll back to v(.+)\?$/))) return `回滚到 v${m[1]}？`;
      if ((m = str.match(/^Remove "(.+)"\?$/))) return `确定要移除“${m[1]}”吗？`;
      if ((m = str.match(/^Remove the branding for (.+)\?$/))) return `确定要移除 ${m[1]} 的品牌定制吗？`;
      if ((m = str.match(/^At least (\d+) seconds$/))) return `至少 ${m[1]} 秒`;
      if ((m = str.match(/^Update to v(.+)$/))) return `更新到 v${m[1]}`;
      if ((m = str.match(/^Update from v(.+) to v(.+)$/))) return `从 v${m[1]} 更新到 v${m[2]}`;
      if ((m = str.match(/^Install v(.+)$/))) return `安装 v${m[1]}`;
      if ((m = str.match(/^Preview v(.+)$/))) return `预览 v${m[1]}`;
      if ((m = str.match(/^Previewing v(.+)$/))) return `正在预览版本 v${m[1]}`;
      if ((m = str.match(/^Installed v(.+)$/))) return `已安装 v${m[1]}`;
      if ((m = str.match(/^Showing v(.+)$/))) return `显示版本 v${m[1]}`;
      if ((m = str.match(/^v(.+) was withdrawn by its publisher$/))) return `v${m[1]} 已被发布者撤回`;
      if ((m = str.match(/^The installed v(.+) was withdrawn by its publisher$/))) return `已安装的 v${m[1]} 已被发布者撤回`;
      if ((m = str.match(/^(\d+) plugins? waiting for approval$/))) return `${m[1]} 个插件等待审批`;
      if ((m = str.match(/^([\d.]+) out of 5 from (\d+) ratings?$/))) return `评分 ${m[1]} / 5（共 ${m[2]} 条评价）`;
      if ((m = str.match(/^Security advisory (.+) \((.+)\)$/))) return `安全通告 ${m[1]} (${m[2]})`;
      if ((m = str.match(/^Signed by the directory, key (.+)$/))) return `由扩展市场目录签名，密钥 ${m[1]}`;
      if ((m = str.match(/^Logs \((\d+)\)$/))) return `日志 (${m[1]})`;
      if ((m = str.match(/^Built-in outside hosts \((\d+)\)(?:,\s*all off)?$/))) return `内置外部主机 (${m[1]})${str.includes('all off') ? '，全部关闭' : ''}`;
      if ((m = str.match(/^Move (.+) up$/))) return `上移 ${m[1]}`;
      if ((m = str.match(/^Move (.+) down$/))) return `下移 ${m[1]}`;
      if ((m = str.match(/^Remove (.+)$/))) return `移除 ${m[1]}`;
      if ((m = str.match(/^Text in (.+)$/))) return `${lookupTranslation(m[1]) ?? m[1]} 文本`;
      if ((m = str.match(/^No text in (.+) yet\.$/))) return `暂无 ${lookupTranslation(m[1]) ?? m[1]} 文本。`;
      if ((m = str.match(/^Force (.+) on for everyone$/))) return `为所有人强制启用 ${lookupTranslation(m[1]) ?? m[1]}`;
      if ((m = str.match(/^At most (\d+) labels\.$/))) return `最多可添加 ${m[1]} 个标签。`;
      if ((m = str.match(/^At most (\d+) company calendars\.$/))) return `最多可添加 ${m[1]} 个企业日历。`;
      if ((m = str.match(/^At most (\d+) replies\.$/))) return `最多可添加 ${m[1]} 个回复模板。`;
      if ((m = str.match(/^(\d+) errors today \(UTC\), most frequent first\.$/))) return `今日（UTC）共 ${m[1]} 个错误，按频次排序。`;
      if ((m = str.match(/^Same as Everyone \((.+)\)$/))) return `与“所有人”相同 (${lookupTranslation(m[1]) ?? m[1]})`;
      if ((m = str.match(/^From Everyone: (.+)$/))) return `继承自“所有人”：${lookupTranslation(m[1]) ?? m[1]}`;
      if ((m = str.match(/^Everyone: (.+)$/))) return `所有人：${lookupTranslation(m[1]) ?? m[1]}`;
      if ((m = str.match(/^Proofreading with (.+)$/))) return `使用 ${lookupTranslation(m[1]) ?? m[1]} 进行校对`;
      if ((m = str.match(/^Dates are written in the user['’]s language and time zone\. Stalwart takes at most 511 bytes of subject and 2047 bytes of text\.$/))) {
        return `日期将按用户的界面语言和所在时区格式化。Stalwart 允许的主题上限为 511 字节，正文上限为 2047 字节。`;
      }
      if ((m = str.match(/^Users in this scope get Everyone['’]s replies and these\. A reply changed here replaces Everyone['’]s for this scope only\.$/))) {
        return `当前作用域内的用户将获得全局“所有人”的模板以及这些专属模板。在此修改的模板仅会在当前作用域中覆盖全局模板。`;
      }
      if ((m = str.match(/^Changes here apply to (.+) only\. Settings this scope doesn['’]t change come from Everyone\.$/))) {
        return `此处的更改仅适用于 ${m[1]}。当前作用域未修改的设置将继承自“所有人”。`;
      }
      if ((m = str.match(/^"(.+)" v(.+) replaces v(.+)\. The copy kept on this server is used; the directory is not asked\.$/))) {
        return `“${m[1]}” v${m[2]} 将替换 v${m[3]}。将使用保存在此服务器上的副本，不向目录发起请求。`;
      }

      // Dynamic pattern for device policy compound descriptions: <description> <enforced>
      for (const [suffix, suffixZh] of [
        ['In the office editor checked by the server; elsewhere in the browser only.', '文档协同编辑器由服务端校验，其余界面由浏览器前端管控。'],
        ['Checked by the server.', '由服务器端强制校验拦截。'],
        ['In the browser only.', '仅在浏览器端管控。'],
      ] as const) {
        if (str.endsWith(suffix)) {
          const prefix = str.slice(0, -suffix.length).trim();
          const prefixZh = lookupTranslation(prefix);
          if (prefixZh) {
            return `${prefixZh} ${suffixZh}`;
          }
        }
      }

      if ((m = str.match(/^Version (.+) is installed\. For each switch that is on, Bulwark skips the matching part of the plugin \(its send confirm, or its banner and new-mail toast\) so nobody is warned twice; version (.+) and later step back by themselves\.$/))) {
        return `已安装版本 ${m[1]}。对于此处开启的每个开关，Bulwark 将跳过插件对应的功能（发信确认，或横幅与新邮件提示），避免重复提醒；版本 ${m[2]} 及更高版本会自动回退关闭。`;
      }
      if ((m = str.match(/^Running with only the servers entered on their admin page: (.+)$/))) {
        return `仅使用其管理设置页面中填写的服务器运行：${m[1]}`;
      }
      if ((m = str.match(/^Without the switch: (.+)$/))) {
        return `未开启开关时：${m[1]}`;
      }
      if ((m = str.match(/^(\d+) of (\d+) enabled\. The switch turns a (?:plugin|theme) on or off for everyone\.$/))) {
        return `已启用 ${m[1]} / ${m[2]} 个。此开关将为所有人开启或关闭。`;
      }
      if ((m = str.match(/^(\d+) active this week$/))) {
        return `本周活跃 ${m[1]} 人`;
      }
      if ((m = str.match(/^(\d+) awaiting approval$/))) {
        return `${m[1]} 个待审批`;
      }
      if ((m = str.match(/^What['’]s new in (\d+) versions$/))) {
        return `${m[1]} 个版本的新增功能`;
      }
      if ((m = str.match(/^Applies, in this order: Everyone, (.+)\.$/))) {
        return `应用顺序依次为：所有人，${m[1]}。`;
      }
      if ((m = str.match(/^(\d+) settings? of its own$/))) {
        return `拥有 ${m[1]} 项独立设置`;
      }

      return undefined;
    }

    function translateTextNode(node: Node) {
      const fullText = node.textContent;
      if (!fullText) return;
      const text = fullText.trim();
      if (!text || text.length > 2000) return;
      if (TRANSLATED_VALUES.has(text)) return;

      const translation = lookupTranslation(text);
      if (translation) {
        const leadingSpace = fullText.match(/^\s*/)?.[0] || '';
        const trailingSpace = fullText.match(/\s*$/)?.[0] || '';
        node.textContent = `${leadingSpace}${translation}${trailingSpace}`;
      }
    }

    function translateElement(el: HTMLElement) {
      // Translate attributes (placeholder, title, aria-label) on any element
      const placeholder = el.getAttribute("placeholder");
      if (placeholder) {
        const translation = lookupTranslation(placeholder.trim());
        if (translation) {
          el.setAttribute("placeholder", translation);
        }
      }

      const title = el.getAttribute("title");
      if (title) {
        const translation = lookupTranslation(title.trim());
        if (translation) {
          el.setAttribute("title", translation);
        }
      }

      const ariaLabel = el.getAttribute("aria-label");
      if (ariaLabel) {
        const translation = lookupTranslation(ariaLabel.trim());
        if (translation) {
          el.setAttribute("aria-label", translation);
        }
      }

      const tagName = el.tagName;
      if (
        tagName === "SCRIPT" ||
        tagName === "STYLE" ||
        tagName === "CODE" ||
        tagName === "PRE" ||
        tagName === "TEXTAREA" ||
        tagName === "INPUT" ||
        el.getAttribute("translate") === "no" ||
        el.dataset.noTranslate === "true"
      ) {
        return;
      }

      // If an element contains only text nodes (e.g. from JSX expressions `{a} text {b}`),
      // translate the combined textContent as a whole if a translation exists.
      if (el.children.length === 0 && el.childNodes.length > 1) {
        const combined = el.textContent?.trim();
        if (combined && combined.length <= 2000 && !TRANSLATED_VALUES.has(combined)) {
          const translation = lookupTranslation(combined);
          if (translation) {
            el.textContent = translation;
            return;
          }
        }
      }

      // Traverse children
      const children = Array.from(el.childNodes);
      for (const child of children) {
        if (child.nodeType === Node.TEXT_NODE) {
          translateTextNode(child);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          translateElement(child as HTMLElement);
        }
      }
    }

    function translateRoot() {
      if (isTranslating) return;
      isTranslating = true;
      try {
        translateElement(document.body);
      } finally {
        isTranslating = false;
      }
    }

    // Initial translation run
    translateRoot();

    // Observe DOM mutations (for client-side tab navigation and async data)
    let animationFrameId: number | null = null;
    const observer = new MutationObserver(() => {
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        translateRoot();
        animationFrameId = null;
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    };
  }, [initialLocale]);

  return <>{children}</>;
}
