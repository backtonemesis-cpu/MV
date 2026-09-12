import React, { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Receipt,
  Landmark,
  Banknote,
  PiggyBank,
  ArrowLeftRight,
  Settings as SettingsIcon,
  MoreHorizontal,
} from 'lucide-react';
import { NavTab } from '../types';
import { canonicalNavTab, navHrefForTab, navTabFromHash } from '../navigationState';

interface NavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  pendingMembersCount: number;
}

interface TabItem {
  id: NavTab;
  label: string;
  mobileLabel: string;
  icon: any;
  badge?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  pendingMembersCount,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const morePanelRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<NavTab>(activeTab);
  const syncingFromLocationRef = useRef(false);
  const lastLocationHashRef = useRef<string | null>(null);

  activeTabRef.current = activeTab;

  const tabs: TabItem[] = [
    { id: 'dashboard', label: 'Home', mobileLabel: 'Home', icon: LayoutDashboard },
    { id: 'activity', label: 'Activity', mobileLabel: 'Activity', icon: Receipt },
    { id: 'accounts', label: 'Accounts', mobileLabel: 'Accounts', icon: Landmark },
    { id: 'income', label: 'Income', mobileLabel: 'Income', icon: Banknote },
    { id: 'savings', label: 'Savings', mobileLabel: 'Savings', icon: PiggyBank },
    { id: 'transfer_plan', label: 'Plan', mobileLabel: 'Plan', icon: ArrowLeftRight },
    {
      id: 'settings',
      label: 'Settings',
      mobileLabel: 'Settings',
      icon: SettingsIcon,
      badge: pendingMembersCount > 0 ? pendingMembersCount : undefined,
    },
  ];

  const canonicalActiveTab = canonicalNavTab(activeTab);
  const mobilePrimaryIds: NavTab[] = ['dashboard', 'activity', 'accounts', 'transfer_plan'];
  const mobilePrimaryTabs = tabs.filter((tab) => mobilePrimaryIds.includes(tab.id));
  const mobileMoreTabs = tabs.filter((tab) => !mobilePrimaryIds.includes(tab.id));
  const isMoreActive = mobileMoreTabs.some((tab) => tab.id === canonicalActiveTab);
  const moreBadge = mobileMoreTabs.some((tab) => Boolean(tab.badge));

  useEffect(() => {
    const syncFromLocation = () => {
      const currentHash = window.location.hash;
      if (syncingFromLocationRef.current && lastLocationHashRef.current === currentHash) return;

      lastLocationHashRef.current = currentHash;
      const locationTab = navTabFromHash(currentHash);
      if (locationTab === canonicalNavTab(activeTabRef.current)) {
        syncingFromLocationRef.current = false;
        return;
      }

      syncingFromLocationRef.current = true;
      onTabChange(locationTab);
    };

    syncFromLocation();
    window.addEventListener('popstate', syncFromLocation);
    window.addEventListener('hashchange', syncFromLocation);
    return () => {
      window.removeEventListener('popstate', syncFromLocation);
      window.removeEventListener('hashchange', syncFromLocation);
    };
  }, [onTabChange]);

  useEffect(() => {
    const canonicalTab = canonicalNavTab(activeTab);
    const locationTab = navTabFromHash(window.location.hash);

    if (syncingFromLocationRef.current) {
      if (locationTab === canonicalTab) {
        syncingFromLocationRef.current = false;
      }
      return;
    }

    if (locationTab === canonicalTab) return;

    const href = navHrefForTab(canonicalTab);
    window.history.pushState(null, '', href);
    lastLocationHashRef.current = window.location.hash;
  }, [activeTab]);

  useEffect(() => {
    setIsMoreOpen(false);
  }, [activeTab]);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.attributeName === 'data-layout-mode')) {
        setIsMoreOpen(false);
      }
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-layout-mode'],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isMoreOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setIsMoreOpen(false);
      moreTriggerRef.current?.focus({ preventScroll: true });
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (
        morePanelRef.current?.contains(event.target) ||
        moreTriggerRef.current?.contains(event.target)
      ) {
        return;
      }
      setIsMoreOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isMoreOpen]);

  const navigate = (tab: NavTab) => {
    setIsMoreOpen(false);
    onTabChange(tab);
  };

  const handleNavLinkClick = (event: React.MouseEvent<HTMLAnchorElement>, tab: NavTab) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    navigate(tab);
  };

  return (
    <>
      {/* Desktop / PC Navigation Bar */}
      <nav className="mv-nav-desktop hidden sm:block border-b border-muted bg-surface transition-colors" aria-label="Primary navigation">
        <div className="mv-shell-boundary mx-auto w-full max-w-[1440px] px-4">
          <div className="mv-desktop-nav-rail flex gap-0.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = canonicalActiveTab === tab.id;
              return (
                <a
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  href={navHrefForTab(tab.id)}
                  onClick={(event) => handleNavLinkClick(event, tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                    isActive
                      ? 'border-accent text-accent bg-accent-soft text-accent'
                      : 'border-transparent text-muted hover:text-main'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-accent' : 'text-muted'}`} aria-hidden="true" />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-danger-soft text-danger">
                      {tab.badge}
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Phone navigation: four primary destinations plus an uncluttered More menu. */}
      <nav className="mv-nav-mobile sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface backdrop-blur-md border-t border-muted pb-safe transition-colors" aria-label="Mobile navigation">
        <div className="mv-mobile-nav-grid grid grid-cols-5 h-14">
          {mobilePrimaryTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = canonicalActiveTab === tab.id;
            return (
              <a
                key={tab.id}
                id={`mobile-nav-tab-${tab.id}`}
                href={navHrefForTab(tab.id)}
                onClick={(event) => handleNavLinkClick(event, tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center h-full min-h-[44px] text-[10px] font-medium transition-colors ${
                  isActive ? 'text-accent font-bold' : 'text-muted'
                }`}
              >
                <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-accent' : 'text-muted'}`} aria-hidden="true" />
                <span>{tab.mobileLabel}</span>
              </a>
            );
          })}

          <button
            ref={moreTriggerRef}
            id="mobile-nav-tab-more"
            type="button"
            onClick={() => setIsMoreOpen((current) => !current)}
            aria-expanded={isMoreOpen}
            aria-controls="mobile-more-navigation"
            className={`relative flex flex-col items-center justify-center h-full min-h-[44px] text-[10px] font-medium transition-colors ${
              isMoreActive || isMoreOpen ? 'text-accent font-bold' : 'text-muted'
            }`}
          >
            <MoreHorizontal className={`w-4 h-4 mb-0.5 ${isMoreActive || isMoreOpen ? 'text-accent' : 'text-muted'}`} aria-hidden="true" />
            <span>More</span>
            {moreBadge && <span className="mv-mobile-nav-badge" aria-hidden="true" />}
          </button>
        </div>
        {isMoreOpen && (
          <div
            ref={morePanelRef}
            id="mobile-more-navigation"
            className="mv-mobile-more-menu"
            aria-label="More navigation"
          >
            {mobileMoreTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = canonicalActiveTab === tab.id;
              return (
                <a
                  key={tab.id}
                  href={navHrefForTab(tab.id)}
                  onClick={(event) => handleNavLinkClick(event, tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`mv-mobile-more-item ${isActive ? 'is-active' : ''}`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{tab.mobileLabel}</span>
                  {tab.badge && (
                    <span className="mv-mobile-more-badge" aria-label={`${tab.badge} pending`}>
                      {tab.badge}
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        )}

      </nav>
    </>
  );
};
