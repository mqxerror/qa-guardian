/**
 * useTransactionHandlers Hook
 * Feature #47: Extracted from MonitoringPage.tsx for modularity
 *
 * Handles all transaction monitoring state and operations
 */

import { useState, useCallback } from 'react';
import { toast } from '../../../stores/toastStore';
import type { TransactionCheck, TransactionResult, TransactionStepInput, TransactionStepAssertion } from '../types';

export interface UseTransactionHandlersReturn {
  // State
  transactions: TransactionCheck[];
  selectedTransaction: TransactionCheck | null;
  transactionResults: TransactionResult[];
  showTransactionModal: boolean;
  isLoadingTxnResults: boolean;

  // Setters
  setSelectedTransaction: (txn: TransactionCheck | null) => void;
  setShowTransactionModal: (show: boolean) => void;
  setTransactions: React.Dispatch<React.SetStateAction<TransactionCheck[]>>;

  // Actions
  fetchTransactions: () => Promise<void>;
  fetchTransactionResults: (transactionId: string) => Promise<void>;
  runTransaction: (transactionId: string) => Promise<void>;
  deleteTransaction: (transactionId: string) => Promise<void>;
}

export function useTransactionHandlers(token: string | null): UseTransactionHandlersReturn {
  const [transactions, setTransactions] = useState<TransactionCheck[]>([]);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionCheck | null>(null);
  const [transactionResults, setTransactionResults] = useState<TransactionResult[]>([]);
  const [isLoadingTxnResults, setIsLoadingTxnResults] = useState(false);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/v1/monitoring/transactions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  }, [token]);

  // Fetch transaction results
  const fetchTransactionResults = useCallback(async (transactionId: string) => {
    if (!token) return;
    setIsLoadingTxnResults(true);
    try {
      const response = await fetch(`/api/v1/monitoring/transactions/${transactionId}/results?limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTransactionResults(data.results || []);
      }
    } catch (error) {
      console.error('Failed to fetch transaction results:', error);
    } finally {
      setIsLoadingTxnResults(false);
    }
  }, [token]);

  // Run transaction manually
  const runTransaction = useCallback(async (transactionId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/transactions/${transactionId}/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('Transaction executed');
        fetchTransactions();
        if (selectedTransaction?.id === transactionId) {
          fetchTransactionResults(transactionId);
        }
      }
    } catch (error) {
      toast.error('Failed to run transaction');
    }
  }, [token, selectedTransaction, fetchTransactions, fetchTransactionResults]);

  // Delete transaction
  const deleteTransaction = useCallback(async (transactionId: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      const response = await fetch(`/api/v1/monitoring/transactions/${transactionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('Transaction deleted');
        if (selectedTransaction?.id === transactionId) {
          setSelectedTransaction(null);
        }
        fetchTransactions();
      }
    } catch (error) {
      toast.error('Failed to delete transaction');
    }
  }, [token, selectedTransaction, fetchTransactions]);

  return {
    // State
    transactions,
    selectedTransaction,
    transactionResults,
    showTransactionModal,
    isLoadingTxnResults,

    // Setters
    setSelectedTransaction,
    setShowTransactionModal,
    setTransactions,

    // Actions
    fetchTransactions,
    fetchTransactionResults,
    runTransaction,
    deleteTransaction,
  };
}

export default useTransactionHandlers;
