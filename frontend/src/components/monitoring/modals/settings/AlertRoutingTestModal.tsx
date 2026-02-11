/**
 * Alert Routing Test Modal
 * Feature #47: Extracted from MonitoringPage.tsx for modularity
 * Feature #127: Mobile responsive design audit and fixes
 * Feature #635: Migrated to Modal/ModalBody/ModalFooter
 *
 * Allows users to test alert routing rules by simulating alerts
 * with different severity levels, check types, and names.
 */

import React, { useState } from 'react';
import { Modal, ModalBody, ModalFooter } from '../../../ui/Modal';
import { toast } from '../../../../stores/toastStore';

export interface AlertRoutingTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

interface MatchedRule {
  rule_name: string;
  destinations: Array<{ type: string; name: string }>;
}

interface TestResult {
  message: string;
  matched_rules: MatchedRule[];
}

export const AlertRoutingTestModal: React.FC<AlertRoutingTestModalProps> = ({
  isOpen,
  onClose,
  token,
}) => {
  const [severity, setSeverity] = useState<'critical' | 'high' | 'medium' | 'low' | 'info'>('critical');
  const [checkType, setCheckType] = useState('uptime');
  const [checkName, setCheckName] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const handleTest = async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/v1/monitoring/alert-routing/rules/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          severity,
          check_type: checkType,
          check_name: checkName || 'Test Check',
          location: 'us-east',
          error_message: 'Test error for routing',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTestResult(data);
      } else {
        toast.error('Failed to test alert routing');
      }
    } catch (error) {
      console.error('Failed to test routing:', error);
      toast.error('Failed to test alert routing');
    }
  };

  const handleClose = () => {
    setTestResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen onClose={handleClose} title="🧪 Test Alert Routing" size="md">
      <ModalBody className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Simulate an alert to see which routing rules would match and where it would be routed.
        </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Severity</label>
              <select
                value={severity}
                onChange={e => setSeverity(e.target.value as typeof severity)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="info">Info</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Check Type</label>
              <select
                value={checkType}
                onChange={e => setCheckType(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
              >
                <option value="uptime">Uptime</option>
                <option value="transaction">Transaction</option>
                <option value="performance">Performance</option>
                <option value="webhook">Webhook</option>
                <option value="dns">DNS</option>
                <option value="tcp">TCP</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Check Name</label>
            <input
              type="text"
              value={checkName}
              onChange={e => setCheckName(e.target.value)}
              placeholder="API Server"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>

          <button
            onClick={handleTest}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Test Routing
          </button>

          {testResult && (
            <div className="rounded-lg bg-muted p-4">
              <h4 className="font-medium text-foreground mb-2">Result</h4>
              <p className="text-sm text-muted-foreground mb-2">{testResult.message}</p>
              {testResult.matched_rules.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">Matched Rules:</p>
                  {testResult.matched_rules.map((rule, i) => (
                    <div key={i} className="text-xs p-2 bg-background rounded">
                      <span className="font-medium">{rule.rule_name}</span>
                      <span className="text-muted-foreground"> → </span>
                      {rule.destinations.map(d => d.type).join(', ')}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

      </ModalBody>
      <ModalFooter>
        <button
          onClick={handleClose}
          className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Close
        </button>
      </ModalFooter>
    </Modal>
  );
};

export default AlertRoutingTestModal;
