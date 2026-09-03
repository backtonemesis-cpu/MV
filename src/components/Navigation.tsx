import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  Landmark,
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
    { id: 'dashboard', label: 'Dashboard', mobileLabel: 'Home', icon: LayoutDashboard },
    { id: 'activity', label: 'Activity', mobileLabel: 'Activity', icon: Receipt },
    { id: 'accounts', label: 'Accounts', mobileLabel: 'Accounts', icon: Landmark },
    { id: 'savings', label: 'Savings', mobileLabel: 'Savings', icon: PiggyBank },
    { id: 'transfer_plan', label: 'Transfer Plan', mobileLabel: 'Plan', icon: ArrowLeftRight },
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
      <nav className="hidden sm:block border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-emerald-600 dark:border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                      : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:border-neutral-300 dark:hover:border-neutral-700'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-400 dark:text-neutral-500'}`} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
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
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-t border-neutral-200 dark:border-neutral-800 pb-safe transition-colors">
        <div className="grid grid-cols-6 h-14">
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
                    ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                    : 'text-neutral-500 dark:text-neutral-400'
                }`}
              >
                <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-400 dark:text-neutral-500'}`} />
                <span className="truncate max-w-[48px]">{tab.mobileLabel}</span>
                {tab.badge && (
                  <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-rose-500" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
