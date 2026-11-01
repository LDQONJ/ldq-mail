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
      if ((m = str.match(/^Built-in outside hosts \((\d+)\)$/))) return `内置外部主机 (${m[1]})`;
      if ((m = str.match(/^"(.+)" v(.+) replaces v(.+)\. The copy kept on this server is used; the directory is not asked\.$/))) {
        return `“${m[1]}” v${m[2]} 将替换 v${m[3]}。将使用保存在此服务器上的副本，不向目录发起请求。`;
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
