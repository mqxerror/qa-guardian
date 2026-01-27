// BillingPage - Extracted from App.tsx for code quality compliance
// Feature #1357: Frontend file size limit enforcement

import { Layout } from '../components/Layout';

export function BillingPage() {
  return (
    <Layout>
      <div className="p-8">
        <h1 className="text-3xl font-bold text-foreground">Billing</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your organization's billing and subscription
        </p>
        <div className="mt-8 max-w-2xl">
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-semibold text-foreground">Current Plan</h3>
            <p className="mt-2 text-muted-foreground">Free Trial</p>
            <button className="mt-4 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90">
              Upgrade Plan
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
