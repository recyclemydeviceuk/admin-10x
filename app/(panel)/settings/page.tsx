import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { backendFetch } from '@/lib/backend';
import { PageHeader } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { BackupsPanel } from './BackupsPanel';
import { fetchBackupStatus } from '@/lib/actions/backups';
import { PasswordPanel, ProfilePanel, SyncingPanel } from './ProfileSettings';
import { DeliveryPanel } from './DeliveryPanel';
import { SubscriptionsPanel } from './SubscriptionsPanel';
import { StorePanel } from './StorePanel';
import { ComingSoonPanel } from './ComingSoonPanel';
import { FaceLockPanel } from './FaceLockPanel';
import { can } from '@/lib/auth';
import { listSignups, type DeliverySettings, type SignupRow, type SubscriptionSettings, type StoreSettings } from '@/lib/actions/settings';

export const metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

// Profile and the face lock belong to every signed-in admin; the store-wide
// tabs stay behind settings.view.
const TABS = [
  { key: 'profile', label: 'Profile', icon: 'users', permission: '' },
  { key: 'face-lock', label: 'Set a Face Lock', icon: 'scan', permission: '' },
  { key: 'store', label: 'Store & warehouse', icon: 'box', permission: 'settings.view' },
  { key: 'delivery', label: 'Delivery', icon: 'truck', permission: 'settings.view' },
  { key: 'subscriptions', label: 'Subscriptions', icon: 'repeat', permission: 'settings.view' },
  { key: 'coming-soon', label: 'Coming soon', icon: 'eye-off', permission: 'settings.maintenance' },
  { key: 'backups', label: 'Backups', icon: 'download', permission: 'settings.backups' },
  { key: 'syncing', label: 'Syncing', icon: 'repeat', permission: 'settings.view' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

type SyncState = { lastRunAt: string | null; log: { at: string; text: string }[]; autoShipments?: boolean };

async function loadSyncState(): Promise<SyncState> {
  const response = await backendFetch('/api/v1/admin/settings');
  if (!response.ok) return { lastRunAt: null, log: [] };
  const body = await response.json().catch(() => ({})) as {
    settings?: { syncing?: SyncState; automation?: SyncState };
  };
  // Accept the former response key during a rolling backend restart, but only
  // expose it to the UI under the Syncing name.
  return body.settings?.syncing ?? body.settings?.automation ?? { lastRunAt: null, log: [] };
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const visibleTabs = TABS.filter((item) => item.permission === '' || can(user, item.permission));
  const tab: TabKey = visibleTabs.some((item) => item.key === params.tab) ? params.tab as TabKey : 'profile';

  // The auth guard has already loaded the canonical backend profile. Reusing
  // it avoids a second request whose error payload could be mistaken for a
  // profile object while the API is restarting or being upgraded.
  const profile = {
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    preferences: user.preferences,
  };

  const syncState = tab === 'syncing'
    ? await loadSyncState()
    : { lastRunAt: null, log: [] };

  // Coming-soon state + the signups it collected, read only when the tab shows.
  let comingSoon = false;
  let signupData: { total: number; signups: SignupRow[] } = { total: 0, signups: [] };
  if (tab === 'coming-soon') {
    const response = await backendFetch('/api/v1/admin/settings');
    if (response.ok) {
      const body = (await response.json().catch(() => ({}))) as { settings?: { store?: { comingSoonMode?: boolean } } };
      comingSoon = Boolean(body.settings?.store?.comingSoonMode);
    }
    signupData = await listSignups();
  }

  // Delivery charges — read fresh from the API so the form opens on what the
  // checkout is actually using right now.
  let delivery: DeliverySettings = { deliveryMode: 'priced', flatShipping: 49, freeShippingOver: 999 };
  if (tab === 'delivery') {
    const response = await backendFetch('/api/v1/admin/settings');
    if (response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        settings?: { store?: { deliveryMode?: 'free' | 'priced'; flatShipping?: number; freeShippingOver?: number } };
      };
      const store = body.settings?.store;
      if (store) {
        delivery = {
          deliveryMode: store.deliveryMode === 'free' ? 'free' : 'priced',
          flatShipping: store.flatShipping ?? 49,
          freeShippingOver: store.freeShippingOver ?? 999,
        };
      }
    }
  }

  let storeSettings: StoreSettings = {
    name: '10X', supportEmail: '', supportPhone: '', codEnabled: true,
    warehouse: { name: '', address: '', city: '', state: '', pincode: '', phone: '' },
  };
  if (tab === 'store') {
    const response = await backendFetch('/api/v1/admin/settings');
    if (response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        settings?: { store?: Partial<StoreSettings>; warehouse?: Partial<StoreSettings['warehouse']> };
      };
      const st = body.settings?.store ?? {};
      const wh = body.settings?.warehouse ?? {};
      storeSettings = {
        name: st.name ?? '10X',
        supportEmail: st.supportEmail ?? '',
        supportPhone: st.supportPhone ?? '',
        codEnabled: st.codEnabled ?? true,
        warehouse: {
          name: wh.name ?? '', address: wh.address ?? '', city: wh.city ?? '',
          state: wh.state ?? '', pincode: wh.pincode ?? '', phone: wh.phone ?? '',
        },
      };
    }
  }

  let subscriptionSettings: SubscriptionSettings = { subscriptionIntervalDays: 28, autopayReminderEveryDays: 3, autopayReminderMax: 5 };
  if (tab === 'subscriptions') {
    const response = await backendFetch('/api/v1/admin/settings');
    if (response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        settings?: { store?: { subscriptionIntervalDays?: number; autopayReminderEveryDays?: number; autopayReminderMax?: number } };
      };
      const store = body.settings?.store;
      if (store) {
        subscriptionSettings = {
          subscriptionIntervalDays: store.subscriptionIntervalDays ?? 28,
          autopayReminderEveryDays: store.autopayReminderEveryDays ?? 3,
          autopayReminderMax: store.autopayReminderMax ?? 5,
        };
      }
    }
  }

  return (
    <>
      <PageHeader kicker="Admin" title="Settings" />
      <div className="scroll-x mb-6 flex gap-1 border-b border-paper-200">
        {visibleTabs.map((item) => (
          <Link key={item.key} href={`/settings?tab=${item.key}`} className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-[12.5px] font-medium ${tab === item.key ? 'border-accent-pressed font-semibold text-fg' : 'border-transparent text-fg-muted hover:text-fg'}`}>
            <Icon name={item.icon} className="h-4 w-4" />{item.label}
          </Link>
        ))}
      </div>
      {/* Settings are forms, not data tables — a readable column beats letting
          inputs stretch the full width of a large screen. */}
      <div className="max-w-3xl">
        {tab === 'profile' ? (<><ProfilePanel profile={profile} isPrimary={user.id === 'primary'} /><PasswordPanel isPrimary={user.id === 'primary'} /></>) : null}
        {tab === 'face-lock' ? <FaceLockPanel /> : null}
        {tab === 'coming-soon' ? <ComingSoonPanel enabled={comingSoon} total={signupData.total} signups={signupData.signups} /> : null}
        {tab === 'store' ? <StorePanel settings={storeSettings} canEdit={can(user, 'settings.delivery')} /> : null}
        {tab === 'delivery' ? <DeliveryPanel delivery={delivery} canEdit={can(user, 'settings.delivery')} /> : null}
        {tab === 'subscriptions' ? <SubscriptionsPanel settings={subscriptionSettings} canEdit={can(user, 'settings.delivery')} /> : null}
        {tab === 'backups' ? <BackupsPanel status={await fetchBackupStatus()} canRun /> : null}
        {tab === 'syncing' ? <SyncingPanel lastRunAt={syncState.lastRunAt} log={syncState.log} autoShipments={Boolean(syncState.autoShipments)} canEdit={can(user, 'settings.syncing')} /> : null}
      </div>
    </>
  );
}
