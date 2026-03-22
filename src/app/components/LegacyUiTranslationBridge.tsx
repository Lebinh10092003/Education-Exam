import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { translateLegacyUiText } from "../i18n/legacyUiFallback";

const ATTRIBUTE_NAMES = ["placeholder", "title", "aria-label"] as const;
const SKIP_TAG_NAMES = new Set(["SCRIPT", "STYLE", "TEXTAREA", "PRE", "CODE"]);

type AttributeName = (typeof ATTRIBUTE_NAMES)[number];

export function LegacyUiTranslationBridge() {
  const { i18n } = useTranslation();
  const textOriginalsRef = useRef(new WeakMap<Text, string>());
  const attributeOriginalsRef = useRef(new WeakMap<Element, Partial<Record<AttributeName, string>>>());
  const isApplyingRef = useRef(false);
  const currentLanguageRef = useRef(i18n.language);

  useEffect(() => {
    currentLanguageRef.current = i18n.language;

    const translate = (value: string) =>
      translateLegacyUiText(currentLanguageRef.current, value);

    const processTextNode = (node: Text) => {
      const parent = node.parentElement;
      if (!parent || SKIP_TAG_NAMES.has(parent.tagName) || parent.closest("[data-legacy-i18n-ignore='true']")) {
        return;
      }

      const original = textOriginalsRef.current.get(node) ?? node.textContent ?? "";
      if (!textOriginalsRef.current.has(node)) {
        textOriginalsRef.current.set(node, original);
      }

      const translated = translate(original);
      if (node.textContent !== translated) {
        node.textContent = translated;
      }
    };

    const processElementAttributes = (element: Element) => {
      const storedAttributes = attributeOriginalsRef.current.get(element) ?? {};

      for (const attributeName of ATTRIBUTE_NAMES) {
        const currentValue = element.getAttribute(attributeName);
        if (currentValue === null) {
          continue;
        }

        const original = storedAttributes[attributeName] ?? currentValue;
        storedAttributes[attributeName] = original;
        element.setAttribute(attributeName, translate(original));
      }

      attributeOriginalsRef.current.set(element, storedAttributes);
    };

    const processNodeTree = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        processTextNode(node as Text);
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      const element = node as Element;
      processElementAttributes(element);

      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let current = walker.nextNode();
      while (current) {
        processTextNode(current as Text);
        current = walker.nextNode();
      }

      for (const child of Array.from(element.querySelectorAll("[placeholder], [title], [aria-label]"))) {
        processElementAttributes(child);
      }
    };

    const applyTranslations = (node: Node = document.body) => {
      isApplyingRef.current = true;
      try {
        processNodeTree(node);
      } finally {
        isApplyingRef.current = false;
      }
    };

    applyTranslations();

    const handleLanguageChanged = (language: string) => {
      currentLanguageRef.current = language;
      applyTranslations();
    };

    i18n.on("languageChanged", handleLanguageChanged);

    const observer = new MutationObserver((mutations) => {
      if (isApplyingRef.current) {
        return;
      }

      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          const target = mutation.target as Text;
          const storedOriginal = textOriginalsRef.current.get(target);
          if (storedOriginal !== undefined) {
            const appliedTranslation = translate(storedOriginal);
            if ((target.textContent ?? "") === appliedTranslation) {
              continue;
            }
          }
          textOriginalsRef.current.set(target, target.textContent ?? "");
          applyTranslations(target);
          continue;
        }

        if (mutation.type === "attributes" && mutation.target instanceof Element) {
          const attributeName = mutation.attributeName as AttributeName | null;
          if (attributeName && ATTRIBUTE_NAMES.includes(attributeName)) {
            const currentValue = mutation.target.getAttribute(attributeName);
            const storedAttributes = attributeOriginalsRef.current.get(mutation.target) ?? {};
            const storedOriginal = storedAttributes[attributeName];
            if (
              currentValue !== null &&
              storedOriginal !== undefined &&
              currentValue === translate(storedOriginal)
            ) {
              continue;
            }
            if (currentValue !== null) {
              storedAttributes[attributeName] = currentValue;
            }
            attributeOriginalsRef.current.set(mutation.target, storedAttributes);
            applyTranslations(mutation.target);
          }
          continue;
        }

        for (const addedNode of Array.from(mutation.addedNodes)) {
          applyTranslations(addedNode);
        }
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRIBUTE_NAMES as unknown as string[],
    });

    return () => {
      observer.disconnect();
      i18n.off("languageChanged", handleLanguageChanged);
    };
  }, [i18n]);

  return null;
}
