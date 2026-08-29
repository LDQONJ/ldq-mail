"use client";

import React, { useEffect } from "react";
import { ADMIN_ZH_DICT } from "@/lib/i18n/admin-zh";

const TRANSLATED_VALUES = new Set(Object.values(ADMIN_ZH_DICT));

export function AdminI18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Determine whether Chinese localization should be enabled
    const browserLang = typeof navigator !== "undefined" ? (navigator.language || "").toLowerCase() : "";
    let isZh = browserLang.startsWith("zh");

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
      if (ADMIN_ZH_DICT[str]) return ADMIN_ZH_DICT[str];

      // Try normalized quotes (replace curly quotes with regular quotes)
      const normalizedQuotes = str.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
      if (ADMIN_ZH_DICT[normalizedQuotes]) return ADMIN_ZH_DICT[normalizedQuotes];

      // Try matching with normalized whitespace (collapse line breaks and multiple spaces)
      const collapsed = str.replace(/\s+/g, ' ');
      if (ADMIN_ZH_DICT[collapsed]) return ADMIN_ZH_DICT[collapsed];

      const collapsedNormalized = normalizedQuotes.replace(/\s+/g, ' ');
      if (ADMIN_ZH_DICT[collapsedNormalized]) return ADMIN_ZH_DICT[collapsedNormalized];

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
      // Translate attributes (placeholder, title, aria-label) on any element (including input, textarea)
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
  }, []);

  return <>{children}</>;
}
