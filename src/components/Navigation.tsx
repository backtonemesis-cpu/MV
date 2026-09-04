import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  Landmark,
  Banknote,
  PiggyBank,
  ArrowLeftRight,
  Settings as SettingsIcon,
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

  return (
    <>
      {/* Desktop Navigation Bar */}
      <nav className="mv-nav-desktop hidden sm:block border-b border-muted bg-surface transition-colors">
        <div className="mv-shell-boundary mx-auto w-full max-w-[1200px] px-4">
          <div className="flex gap-0.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                    isActive
                      ? 'border-accent text-accent bg-accent-soft text-accent'
                      : 'border-transparent text-muted hover:text-main'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-accent' : 'text-muted'}`} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-danger-soft text-on-accent">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar (iPhone-first with 44px+ touch ergonomics) */}
      <nav className="mv-nav-mobile sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface backdrop-blur-md border-t border-muted pb-safe transition-colors">
        <div className="mv-mobile-nav-grid grid grid-cols-7 h-14">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`mobile-nav-tab-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
                className={`relative flex flex-col items-center justify-center h-full min-h-[44px] text-[10px] font-medium transition-colors ${
                  isActive
                    ? 'text-accent font-bold'
                    : 'text-muted'
                }`}
              >
                <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-accent' : 'text-muted'}`} />
                <span className="truncate max-w-[44px]">{tab.mobileLabel}</span>
                {tab.badge && (
                  <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-danger-soft" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
