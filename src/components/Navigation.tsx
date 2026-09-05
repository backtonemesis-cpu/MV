import React, { useState } from 'react';
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

  const mobilePrimaryIds: NavTab[] = ['dashboard', 'activity', 'accounts', 'transfer_plan'];
  const mobilePrimaryTabs = tabs.filter((tab) => mobilePrimaryIds.includes(tab.id));
  const mobileMoreTabs = tabs.filter((tab) => !mobilePrimaryIds.includes(tab.id));
  const isMoreActive = mobileMoreTabs.some((tab) => tab.id === activeTab);
  const moreBadge = mobileMoreTabs.some((tab) => Boolean(tab.badge));

  const navigate = (tab: NavTab) => {
    setIsMoreOpen(false);
    onTabChange(tab);
  };

  return (
    <>
      {/* Desktop / PC Navigation Bar */}
      <nav className="mv-nav-desktop hidden sm:block border-b border-muted bg-surface transition-colors">
        <div className="mv-shell-boundary mx-auto w-full max-w-[1200px] px-4">
          <div className="mv-desktop-nav-rail flex gap-0.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => navigate(tab.id)}
                  className={`flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                    isActive
                      ? 'border-accent text-accent bg-accent-soft text-accent'
                      : 'border-transparent text-muted hover:text-main'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-accent' : 'text-muted'}`} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-danger-soft text-danger">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Phone navigation: four primary destinations plus an uncluttered More menu. */}
      <nav className="mv-nav-mobile sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface backdrop-blur-md border-t border-muted pb-safe transition-colors">
        {isMoreOpen && (
          <div className="mv-mobile-more-menu" role="menu" aria-label="More navigation">
            {mobileMoreTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="menuitem"
                  onClick={() => navigate(tab.id)}
                  className={`mv-mobile-more-item ${isActive ? 'is-active' : ''}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{tab.mobileLabel}</span>
                  {tab.badge && (
                    <span className="mv-mobile-more-badge" aria-label={`${tab.badge} pending`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="mv-mobile-nav-grid grid grid-cols-5 h-14">
          {mobilePrimaryTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`mobile-nav-tab-${tab.id}`}
                onClick={() => navigate(tab.id)}
                className={`relative flex flex-col items-center justify-center h-full min-h-[44px] text-[10px] font-medium transition-colors ${
                  isActive ? 'text-accent font-bold' : 'text-muted'
                }`}
              >
                <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-accent' : 'text-muted'}`} />
                <span>{tab.mobileLabel}</span>
              </button>
            );
          })}

          <button
            id="mobile-nav-tab-more"
            type="button"
            onClick={() => setIsMoreOpen((current) => !current)}
            aria-expanded={isMoreOpen}
            aria-haspopup="menu"
            className={`relative flex flex-col items-center justify-center h-full min-h-[44px] text-[10px] font-medium transition-colors ${
              isMoreActive || isMoreOpen ? 'text-accent font-bold' : 'text-muted'
            }`}
          >
            <MoreHorizontal className={`w-4 h-4 mb-0.5 ${isMoreActive || isMoreOpen ? 'text-accent' : 'text-muted'}`} />
            <span>More</span>
            {moreBadge && <span className="mv-mobile-nav-badge" aria-hidden="true" />}
          </button>
        </div>
      </nav>
    </>
  );
};
