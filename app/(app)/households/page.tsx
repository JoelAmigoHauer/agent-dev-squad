import Link from 'next/link';
import { getServerClient } from '@/lib/db/server';
import { PageHeader } from '@/components/ui/shell';
import { Card, EmptyState, MoneyCell, StatusPill } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function HouseholdsPage() {
  const supabase = await getServerClient();

  const { data: households } = await supabase
    .from('households').select('id, name, created_at').order('name');

  const [{ data: mandates }, { data: openRecs }, { data: accounts }] = await Promise.all([
    supabase.from('mandates').select('household_id, version, status').eq('status', 'published'),
    supabase.from('recommendations').select('household_id').eq('status', 'pending'),
    supabase.from('accounts').select('id, household_id'),
  ]);

  const accountsByHousehold = new Map<string, string[]>();
  for (const account of accounts ?? []) {
    accountsByHousehold.set(account.household_id,
      [...(accountsByHousehold.get(account.household_id) ?? []), account.id]);
  }

  const { data: positions } = (accounts ?? []).length
    ? await supabase.from('positions').select('account_id, market_value, as_of')
    : { data: [] };

  const valueByHousehold = new Map<string, number>();
  const householdByAccount = new Map((accounts ?? []).map((a) => [a.id, a.household_id]));
  for (const position of positions ?? []) {
    const householdId = householdByAccount.get(position.account_id);
    if (!householdId) continue;
    valueByHousehold.set(householdId,
      (valueByHousehold.get(householdId) ?? 0) + Number(position.market_value));
  }

  const mandateByHousehold = new Map((mandates ?? []).map((m) => [m.household_id, m]));
  const openByHousehold = new Map<string, number>();
  for (const rec of openRecs ?? []) {
    openByHousehold.set(rec.household_id, (openByHousehold.get(rec.household_id) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader title="Households" subtitle={`${households?.length ?? 0} in the book`} />
      <Card>
        {(households ?? []).length === 0 ? (
          <EmptyState title="No households yet"
                      body="Import or sync a custodian extract from Settings to create the first one." />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-subtle">
                <th className="px-5 py-3 font-medium">Household</th>
                <th className="px-5 py-3 text-right font-medium">Market value</th>
                <th className="px-5 py-3 font-medium">Mandate</th>
                <th className="px-5 py-3 text-right font-medium">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(households ?? []).map((household) => {
                const mandate = mandateByHousehold.get(household.id);
                return (
                  <tr key={household.id} className="hover:bg-surface-sunken">
                    <td className="px-5 py-3">
                      <Link href={`/households/${household.id}`} className="font-medium hover:text-accent">
                        {household.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <MoneyCell value={valueByHousehold.get(household.id) ?? 0} />
                    </td>
                    <td className="px-5 py-3">
                      {mandate
                        ? <span className="flex items-center gap-2">
                            <StatusPill status="published" />
                            <span className="tabular text-text-subtle">v{mandate.version}</span>
                          </span>
                        : <span className="text-text-subtle">not configured</span>}
                    </td>
                    <td className="px-5 py-3 text-right tabular">
                      {openByHousehold.get(household.id) ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
