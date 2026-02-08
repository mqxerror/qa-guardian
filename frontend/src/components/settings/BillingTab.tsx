// BillingTab - Plan management and billing
// Feature #451: Extracted from SettingsPage.tsx

import { useState } from 'react';

export function BillingTab() {
  const [currentPlan] = useState('Pro');
  const [billingCycle] = useState('Monthly');
  const [nextBilling] = useState('2026-02-25');

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Current Plan</h3>
            <p className="text-2xl font-bold text-primary mt-2">{currentPlan}</p>
            <p className="text-sm text-muted-foreground mt-1">Billed {billingCycle.toLowerCase()}</p>
          </div>
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
            Upgrade Plan
          </button>
        </div>
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Next billing date: <span className="text-foreground font-medium">{nextBilling}</span>
          </p>
        </div>
      </div>

      {/* Usage */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Usage This Month</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Test Runs</span>
              <span className="text-foreground font-medium">245 / 1,000</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: '24.5%' }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Storage Used</span>
              <span className="text-foreground font-medium">2.3 GB / 10 GB</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: '23%' }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Team Members</span>
              <span className="text-foreground font-medium">5 / 10</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: '50%' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Payment Method</h3>
            <p className="text-sm text-muted-foreground mt-1">•••• •••• •••• 4242</p>
            <p className="text-xs text-muted-foreground">Expires 12/2028</p>
          </div>
          <button className="text-primary hover:underline text-sm">Update</button>
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Billing History</h3>
        <div className="space-y-3">
          {[
            { date: '2026-01-25', amount: '$49.00', status: 'Paid' },
            { date: '2025-12-25', amount: '$49.00', status: 'Paid' },
            { date: '2025-11-25', amount: '$49.00', status: 'Paid' },
          ].map((invoice, idx) => (
            <div key={idx} className="flex justify-between items-center py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm text-foreground">{invoice.date}</p>
                <p className="text-xs text-muted-foreground">{invoice.amount}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-success">{invoice.status}</span>
                <button className="text-primary hover:underline text-xs">Download</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
