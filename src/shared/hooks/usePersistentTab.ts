import { useEffect, useState } from "react";

type UsePersistentTabOptions<T extends string> = {
  storageKey: string;
  tabs: readonly T[];
  defaultTab?: T;
};

const hasTab = <T extends string>(tabs: readonly T[], tab: string): tab is T =>
  tabs.includes(tab as T);

export const usePersistentTab = <T extends string>({
  storageKey,
  tabs,
  defaultTab,
}: UsePersistentTabOptions<T>) => {
  const getFallbackTab = (): T | "" => {
    if (defaultTab && hasTab(tabs, defaultTab)) {
      return defaultTab;
    }

    return tabs[0] ?? "";
  };

  const resolveInitialTab = (): T | "" => {
    const fallback = getFallbackTab();

    if (typeof window === "undefined") {
      return fallback;
    }

    const storedTab = window.localStorage.getItem(storageKey);

    if (storedTab && hasTab(tabs, storedTab)) {
      return storedTab;
    }

    return fallback;
  };

  const [activeTab, setActiveTab] = useState<T | "">(resolveInitialTab);

  useEffect(() => {
    const fallback = getFallbackTab();

    setActiveTab((currentTab) => {
      if (currentTab && hasTab(tabs, currentTab)) {
        return currentTab;
      }

      if (typeof window === "undefined") {
        return fallback;
      }

      const storedTab = window.localStorage.getItem(storageKey);
      if (storedTab && hasTab(tabs, storedTab)) {
        return storedTab;
      }

      return fallback;
    });
  }, [defaultTab, storageKey, tabs]);

  useEffect(() => {
    if (typeof window === "undefined" || !activeTab) return;

    window.localStorage.setItem(storageKey, activeTab);
  }, [activeTab, storageKey]);

  return [activeTab, setActiveTab] as const;
};
