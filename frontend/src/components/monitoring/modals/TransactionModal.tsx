/**
 * TransactionModal Component
 * Feature #47: Extracted from MonitoringPage.tsx for modularity
 * Feature #127: Mobile responsive design audit and fixes
 * Feature #635: Migrated to Modal/ModalBody/ModalFooter
 *
 * Handles creating multi-step transaction monitors
 */

import { useState, useEffect } from 'react';
import { Modal, ModalBody, ModalFooter } from '../../ui/Modal';
import { TransactionStepAssertion, TransactionCheck, TransactionStepInput } from '../types';
import { toast } from '../../../stores/toastStore';

export interface TransactionModalProps {
  isOpen: boolean;
  token: string;
  onClose: () => void;
  onTransactionCreated: (transaction: TransactionCheck) => void;
}

// Default step template
const createDefaultStep = (): TransactionStepInput => ({
  name: '',
  url: '',
  method: 'GET' as const,
  expected_status: 200,
  assertions: [],
});

export default function TransactionModal({
  isOpen,
  token,
  onClose,
  onTransactionCreated,
}: TransactionModalProps) {
  // Form state
  const [txnName, setTxnName] = useState('');
  const [txnDescription, setTxnDescription] = useState('');
  const [txnInterval, setTxnInterval] = useState(300);
  const [txnSteps, setTxnSteps] = useState<TransactionStepInput[]>([createDefaultStep()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setTxnName('');
    setTxnDescription('');
    setTxnInterval(300);
    setTxnSteps([createDefaultStep()]);
  };

  const addStep = () => {
    setTxnSteps([...txnSteps, createDefaultStep()]);
  };

  const removeStep = (index: number) => {
    if (txnSteps.length > 1) {
      setTxnSteps(txnSteps.filter((_, i) => i !== index));
    }
  };

  const updateStep = <K extends keyof TransactionStepInput>(
    index: number,
    field: K,
    value: TransactionStepInput[K]
  ) => {
    setTxnSteps(prev => prev.map((step, i) =>
      i === index ? { ...step, [field]: value } : step
    ));
  };

  const addAssertionToStep = (stepIndex: number) => {
    const updated = [...txnSteps];
    updated[stepIndex].assertions.push({
      type: 'status',
      operator: 'equals',
      value: 200,
    });
    setTxnSteps(updated);
  };

  const updateAssertion = <K extends keyof TransactionStepAssertion>(
    stepIndex: number,
    assertionIndex: number,
    field: K,
    value: TransactionStepAssertion[K]
  ) => {
    setTxnSteps(prev => prev.map((step, sIdx) =>
      sIdx === stepIndex
        ? {
            ...step,
            assertions: step.assertions.map((assertion, aIdx) =>
              aIdx === assertionIndex ? { ...assertion, [field]: value } : assertion
            ),
          }
        : step
    ));
  };

  const removeAssertion = (stepIndex: number, assertionIndex: number) => {
    const updated = [...txnSteps];
    updated[stepIndex].assertions = updated[stepIndex].assertions.filter((_, i) => i !== assertionIndex);
    setTxnSteps(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmitting(true);

    try {
      // Process steps - parse headers from text format
      const processedSteps = txnSteps.map(step => ({
        name: step.name,
        url: step.url,
        method: step.method,
        expected_status: step.expected_status,
        headers: step.headers ? parseHeaders(step.headers) : undefined,
        body: step.body || undefined,
        assertions: step.assertions.length > 0 ? step.assertions : undefined,
      }));

      const response = await fetch('/api/v1/monitoring/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: txnName,
          description: txnDescription || undefined,
          interval: txnInterval,
          steps: processedSteps,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Transaction created successfully');
        onTransactionCreated(data.transaction);
        onClose();
      } else {
        toast.error(data.error || 'Failed to create transaction');
      }
    } catch (error) {
      console.error('Error creating transaction:', error);
      toast.error('Failed to create transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Parse headers from text format (Key: Value\n) to object
  const parseHeaders = (text: string): Record<string, string> => {
    const headers: Record<string, string> = {};
    text.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        headers[key.trim()] = valueParts.join(':').trim();
      }
    });
    return headers;
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen onClose={onClose} title="Create Transaction" size="lg">
      <form id="transaction-form" onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Name</label>
              <input
                type="text"
                value={txnName}
                onChange={e => setTxnName(e.target.value)}
                placeholder="Login Flow"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Interval</label>
              <select
                value={txnInterval}
                onChange={e => setTxnInterval(parseInt(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
              >
                <option value={60}>1 min</option>
                <option value={300}>5 min</option>
                <option value={600}>10 min</option>
                <option value={900}>15 min</option>
                <option value={1800}>30 min</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description (optional)</label>
            <input
              type="text"
              value={txnDescription}
              onChange={e => setTxnDescription(e.target.value)}
              placeholder="Monitor the user login flow"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-foreground">Steps</label>
              <button
                type="button"
                onClick={addStep}
                className="text-xs text-primary hover:text-primary/80"
              >
                + Add Step
              </button>
            </div>
            <div className="space-y-4">
              {txnSteps.map((step, stepIndex) => (
                <div key={stepIndex} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                      {stepIndex + 1}
                    </span>
                    {txnSteps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStep(stepIndex)}
                        className="text-xs text-destructive hover:text-destructive"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Step Name</label>
                      <input
                        type="text"
                        value={step.name}
                        onChange={e => updateStep(stepIndex, 'name', e.target.value)}
                        placeholder="Get login page"
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Method</label>
                        <select
                          value={step.method}
                          onChange={e => updateStep(stepIndex, 'method', e.target.value as TransactionStepInput['method'])}
                          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="PATCH">PATCH</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-muted-foreground mb-1">Expected Status</label>
                        <input
                          type="number"
                          value={step.expected_status}
                          onChange={e => updateStep(stepIndex, 'expected_status', parseInt(e.target.value))}
                          min={100}
                          max={599}
                          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs text-muted-foreground mb-1">URL</label>
                    <input
                      type="url"
                      value={step.url}
                      onChange={e => updateStep(stepIndex, 'url', e.target.value)}
                      placeholder="https://api.example.com/login"
                      required
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                    />
                  </div>
                  {(step.method === 'POST' || step.method === 'PUT' || step.method === 'PATCH') && (
                    <>
                      <div className="mb-3">
                        <label className="block text-xs text-muted-foreground mb-1">Headers</label>
                        <textarea
                          value={step.headers || ''}
                          onChange={e => updateStep(stepIndex, 'headers', e.target.value)}
                          placeholder="Content-Type: application/json"
                          rows={2}
                          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground font-mono"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="block text-xs text-muted-foreground mb-1">Body</label>
                        <textarea
                          value={step.body || ''}
                          onChange={e => updateStep(stepIndex, 'body', e.target.value)}
                          placeholder='{"username": "test", "password": "test123"}'
                          rows={2}
                          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground font-mono"
                        />
                      </div>
                    </>
                  )}

                  {/* Assertions */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs text-muted-foreground">Assertions</label>
                      <button
                        type="button"
                        onClick={() => addAssertionToStep(stepIndex)}
                        className="text-xs text-primary hover:text-primary/80"
                      >
                        + Add Assertion
                      </button>
                    </div>
                    {step.assertions.length > 0 && (
                      <div className="space-y-2">
                        {step.assertions.map((assertion, assertionIndex) => (
                          <div key={assertionIndex} className="flex items-center gap-2 rounded border border-border p-2">
                            <select
                              value={assertion.type}
                              onChange={e => updateAssertion(stepIndex, assertionIndex, 'type', e.target.value as TransactionStepAssertion['type'])}
                              className="rounded border border-input bg-background px-2 py-1 text-xs"
                            >
                              <option value="status">Status Code</option>
                              <option value="responseTime">Response Time</option>
                              <option value="bodyContains">Body Contains</option>
                              <option value="headerContains">Header Contains</option>
                            </select>
                            <select
                              value={assertion.operator || 'equals'}
                              onChange={e => updateAssertion(stepIndex, assertionIndex, 'operator', e.target.value as TransactionStepAssertion['operator'])}
                              className="rounded border border-input bg-background px-2 py-1 text-xs"
                            >
                              <option value="equals">equals</option>
                              <option value="contains">contains</option>
                              <option value="lessThan">less than</option>
                              <option value="greaterThan">greater than</option>
                            </select>
                            <input
                              type={assertion.type === 'responseTime' || assertion.type === 'status' ? 'number' : 'text'}
                              value={assertion.value}
                              onChange={e => updateAssertion(
                                stepIndex,
                                assertionIndex,
                                'value',
                                assertion.type === 'responseTime' || assertion.type === 'status' ? parseInt(e.target.value) : e.target.value
                              )}
                              placeholder="Value"
                              className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => removeAssertion(stepIndex, assertionIndex)}
                              className="text-destructive hover:text-destructive text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="transaction-form"
            disabled={isSubmitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Transaction'}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
