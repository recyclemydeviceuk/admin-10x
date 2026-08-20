'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { ToastProvider } from '@/components/Toast';
import { ConfirmProvider } from '@/components/Confirm';
import { NotificationProvider, NotificationBell } from '@/components/NotificationCenter';
import type { NavGroup } from '@/lib/nav';
import { saveSidebarCollapsed } from '@/lib/actions/profile';

type Props = {
  nav: NavGroup[];
  user: {
    name: string;
    email: string;
    roleName: string;
    avatarUrl: string;
    preferences: {
      fontScale: number;
      density: 'comfortable' | 'compact';
      sidebarCollapsed: boolean;
      reduceMotion: boolean;
    };
  };
  badges?: Record<string, number>;
  logout: () => Promise<void>;
  children: React.ReactNode;
};

export function AdminShell({ nav, user, badges = {}, logout, children }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState(!user.preferences.sidebarCollapsed);

  useEffect(() => setMobileOpen(false), [pathname]);

  const toggleExpanded = () => {
    setExpanded((v) => {
      const next = !v;
      void saveSidebarCollapsed(!next);
      return next;
    });
  };

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  const navBody = (compact: boolean) => (
    <nav className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-1">
      {nav.map((group) => (
        <div key={group.name} className={compact ? 'mb-2' : 'mb-2.5'}>
          {compact ? (
            <div className="mx-auto mb-1 h-px w-5 bg-white/10" />
          ) : (
            <p className="mb-0.5 px-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/30">
              {group.name}
            </p>
          )}
          <ul>
            {group.items.map((item) => {
              const active = isActive(item.href);
              const badge = badges[item.href];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={compact ? item.label : undefined}
                    className={`relative flex items-center rounded-md text-[12px] font-medium transition-colors duration-150 ${
                      compact ? 'mx-auto h-8 w-8 justify-center' : 'gap-2 px-2 py-[5px]'
                    } ${
                      active
                        ? 'bg-accent text-accent-ink'
                        : 'text-white/70 hover:bg-white/[0.07] hover:text-white'
                    }`}
                  >
                    <Icon name={item.icon} className="h-3.5 w-3.5 shrink-0" />
                    {!compact ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
                    {!compact && badge ? (
                      <span
                        className={`rounded-full px-1.5 py-px text-[9px] font-bold tabular-nums ${
                          active ? 'bg-ink text-accent' : 'bg-accent text-accent-ink'
                        }`}
                      >
                        {badge > 99 ? '99+' : badge}
                      </span>
                    ) : null}
                    {compact && badge ? (
                      <span className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${active ? 'bg-ink' : 'bg-accent'}`} />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const userFooter = (compact: boolean) => (
    <div className={`shrink-0 border-t border-white/[0.07] ${compact ? 'px-1.5 py-2' : 'px-2.5 py-2.5'}`}>
      <div className={`mb-1.5 flex items-center ${compact ? 'justify-center' : 'gap-2'}`}>
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" title={compact ? `${user.name} · ${user.roleName}` : undefined} />
        ) : (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink" title={compact ? `${user.name} · ${user.roleName}` : undefined}>
            {user.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        {!compact ? (
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold leading-tight text-white">{user.name}</p>
            <p className="truncate text-[10px] text-accent">{user.roleName}</p>
          </div>
        ) : null}
      </div>
      <div className={compact ? 'space-y-0.5' : 'space-y-0.5 border-t border-white/[0.07] pt-2'}>
        <NotificationBell compact={compact} />
        <form action={logout}>
          <button
            type="submit"
            title="Sign out"
            className={`flex items-center rounded-md text-[12px] font-medium text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white ${
              compact ? 'mx-auto h-8 w-8 justify-center' : 'w-full gap-2 px-2 py-[5px]'
            }`}
          >
            <Icon name="logout" className="h-3.5 w-3.5 shrink-0" />
            {!compact ? <span className="min-w-0 flex-1 truncate text-left">Sign out</span> : null}
          </button>
        </form>
      </div>
    </div>
  );

  const brand = (compact: boolean, showToggle: boolean) => (
    <div className={`flex shrink-0 items-center ${compact ? 'flex-col gap-2 px-1.5 py-3' : 'justify-between gap-1 px-2.5 py-3'}`}>
      <Link href="/" className={compact ? 'flex justify-center' : 'flex min-w-0 items-center'}>
        <Image
          src="/10x-logo.webp"
          alt="10X"
          width={compact ? 36 : 64}
          height={24}
          className={compact ? 'h-5 w-auto' : 'h-6 w-auto'}
          priority
        />
      </Link>
      {showToggle ? (
        <button
          type="button"
          onClick={toggleExpanded}
          aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Icon name={compact ? 'chevronRight' : 'chevronLeft'} className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );

  const desktopWidth = expanded ? 'w-[208px]' : 'w-16';
  const desktopPad = expanded ? 'lg:pl-[208px]' : 'lg:pl-16';

  return (
    <ToastProvider>
      <ConfirmProvider>
      <NotificationProvider>
      <div
        className={`min-h-dvh bg-white ${desktopPad} ${user.preferences.reduceMotion ? '' : 'transition-[padding] duration-200'} ${user.preferences.density === 'compact' ? '[--panel-density:0.85]' : ''}`}
        style={{ fontSize: `${user.preferences.fontScale}%` }}
      >
        <aside
          className={`fixed inset-y-0 left-0 z-40 hidden flex-col bg-ink lg:flex ${user.preferences.reduceMotion ? '' : 'transition-[width] duration-200'} ${desktopWidth}`}
        >
          {brand(!expanded, true)}
          {navBody(!expanded)}
          {userFooter(!expanded)}
        </aside>

        <header className="sticky top-0 z-40 flex items-center justify-between bg-ink px-4 py-2.5 lg:hidden">
          <Link href="/" className="flex items-center">
            <Image src="/10x-logo.webp" alt="10X" width={58} height={24} className="h-6 w-auto" priority />
          </Link>
          <div className="flex items-center gap-1">
            <div className="w-9">
              <NotificationBell compact />
            </div>
            <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-white hover:bg-white/10">
              <Icon name="menu" />
            </button>
          </div>
        </header>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button aria-label="Close menu" className="absolute inset-0 bg-ink/60" onClick={() => setMobileOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-[min(85%,13rem)] flex-col bg-ink shadow-pop">
              <div className="flex items-center justify-between pr-1">
                {brand(false, false)}
                <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" className="mr-2 rounded-lg p-2 text-white/50 hover:bg-white/10">
                  <Icon name="x" />
                </button>
              </div>
              {navBody(false)}
              {userFooter(false)}
            </div>
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-[1240px] px-5 py-8 md:px-10 md:py-10">{children}</main>
      </div>
      </NotificationProvider>
    </ConfirmProvider>
    </ToastProvider>
  );
}
