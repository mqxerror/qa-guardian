/**
 * TransactionsTab Component
 * Feature #47: Extracted from MonitoringPage.tsx for modularity
 *
 * Handles transaction monitoring display - multi-step API flow verification
 */

import { TransactionCheck, TransactionResult } from './types';

export interface TransactionsTabProps {
  // Data
  transactions: TransactionCheck[];
  selectedTransaction: TransactionCheck | null;
  transactionResults: TransactionResult[];
  // Loading states
  isLoading: boolean;
  isLoadingTxnResults: boolean;
  // Actions
  setSelectedTransaction: (txn: TransactionCheck | null) => void;
  setShowTransactionModal: (show: boolean) => void;
  runTransaction: (id: string) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
}

export function TransactionsTab({
  transactions,
  selectedTransaction,
  transactionResults,
  isLoading,
  isLoadingTxnResults,
  setSelectedTransaction,
  setShowTransactionModal,
  runTransaction,
  deleteTransaction,
}: TransactionsTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <div className="text-4xl mb-4">🔄</div>
        <h3 className="text-lg font-medium text-foreground">No transactions yet</h3>
        <p className="mt-2 text-muted-foreground">Create multi-step transaction monitors to verify user flows.</p>
        <button
          onClick={() => setShowTransactionModal(true)}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Create Transaction
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Transactions List */}
      <div className="lg:col-span-2">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Steps</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Interval</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transactions.map(txn => (
                <tr
                  key={txn.id}
                  className={`hover:bg-muted/30 cursor-pointer ${selectedTransaction?.id === txn.id ? 'bg-primary/5' : ''}`}
                  onClick={() => setSelectedTransaction(txn)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{txn.name}</div>
                    {txn.description && (
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">{txn.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {txn.steps.length} steps
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {txn.interval >= 60 ? `${Math.floor(txn.interval / 60)}m` : `${txn.interval}s`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                      txn.enabled ? 'bg-green-100 text-green-700' : 'bg-muted text-foreground'
                    }`}>
                      {txn.enabled ? '✓ Active' : '⏸ Paused'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => runTransaction(txn.id)}
                        title="Run now"
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        ▶️
                      </button>
                      <button
                        onClick={() => deleteTransaction(txn.id)}
                        title="Delete"
                        className="rounded p-1.5 text-muted-foreground hover:bg-red-100 hover:text-red-600"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Details Panel */}
      <div className="lg:col-span-1">
        {selectedTransaction ? (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-semibold text-foreground mb-4">{selectedTransaction.name}</h3>
            {selectedTransaction.description && (
              <p className="text-sm text-muted-foreground mb-4">{selectedTransaction.description}</p>
            )}

            {/* Transaction Steps */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-foreground mb-2">Steps ({selectedTransaction.steps.length})</h4>
              <div className="space-y-2">
                {selectedTransaction.steps.map((step, index) => (
                  <div key={step.id} className="rounded border border-border p-2 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                        {index + 1}
                      </span>
                      <span className="font-medium text-foreground">{step.name}</span>
                    </div>
                    <div className="ml-7 space-y-1 text-muted-foreground">
                      <div className="font-mono">
                        <span className="text-blue-600">{step.method}</span> {step.url}
                      </div>
                      <div>Expected: {step.expected_status}</div>
                      {step.assertions && step.assertions.length > 0 && (
                        <div>Assertions: {step.assertions.length}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Results */}
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Recent Results</h4>
              {isLoadingTxnResults ? (
                <div className="text-center py-4">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto"></div>
                </div>
              ) : transactionResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">No results yet. Run the transaction to see results.</p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {transactionResults.map(result => (
                    <div key={result.id} className="rounded border border-border p-2 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-medium ${result.status === 'passed' ? 'text-green-600' : 'text-red-600'}`}>
                          {result.status === 'passed' ? '✓ Passed' : '✗ Failed'}
                        </span>
                        <span className="text-muted-foreground">{result.total_duration}ms</span>
                      </div>
                      <div className="text-muted-foreground">
                        {new Date(result.executed_at).toLocaleString()}
                      </div>
                      <div className="text-muted-foreground">
                        Steps: {result.steps_passed}/{result.steps_passed + result.steps_failed}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
            Select a transaction to view details
          </div>
        )}
      </div>
    </div>
  );
}
