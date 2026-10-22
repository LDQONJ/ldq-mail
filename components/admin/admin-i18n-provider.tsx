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
