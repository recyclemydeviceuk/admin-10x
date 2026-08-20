import { requirePermission } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import type { Customer, Product } from '@/lib/types';
import { PageHeader, BackLink } from '@/components/ui';
import { NewOrderForm } from './NewOrderForm';

export const metadata = { title: 'New order' };
export const dynamic = 'force-dynamic';

export default async function NewOrderPage() {
  await requirePermission('orders.create');
  const [customers, products] = await Promise.all([
    readCollection<Customer[]>('customers'),
    readCollection<Product[]>('products'),
  ]);

  const tiers = products.flatMap((p) =>
    p.tiers.filter((t) => t.available).map((t) => ({ id: t.id, name: `${p.name} ${t.name}`, packets: t.packets, oneTimePrice: t.oneTimePrice })),
  );

  return (
    <>
      <BackLink href="/orders" label="All orders" />
      <PageHeader
        kicker="Store"
        title="New order"
        description="For phone, WhatsApp or replacement orders the team takes by hand."
      />
      <NewOrderForm
        customers={customers
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, city: c.city, state: c.state }))}
        tiers={tiers}
      />
    </>
  );
}
