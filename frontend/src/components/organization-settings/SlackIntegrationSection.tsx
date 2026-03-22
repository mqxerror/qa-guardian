/**
 * SlackIntegrationSection - Slack workspace connection management
 * Extracted from OrganizationSettingsPage.tsx for component decomposition (Agent 7)
 * Feature #709: React Query integration for Slack connection
 */

import { useState } from 'react';
import { toast } from '../../stores/toastStore';
import { Button } from '../ui/button';
import { CheckCircle2, Link2 } from 'lucide-react';
import {
  useSlackConnection,
  useConnectSlack,
  useDisconnectSlack,
} from '../../hooks/api';

export function SlackIntegrationSection() {
  const [workspaceName, setWorkspaceName] = useState('');

  const { data: slackData = { connected: false }, isLoading } = useSlackConnection();
  const connectMutation = useConnectSlack();
  const disconnectMutation = useDisconnectSlack();

  const handleConnect = async () => {
    try {
      await connectMutation.mutateAsync(workspaceName || 'Dev Workspace');
      toast.success('Slack workspace connected successfully!');
      setWorkspaceName('');
    } catch {
      toast.error('Failed to connect Slack');
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Slack?')) return;
    try {
      await disconnectMutation.mutateAsync();
      toast.success('Slack workspace disconnected');
    } catch {
      toast.error('Failed to disconnect Slack');
    }
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString();

  if (isLoading) {
    return (
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground">Slack Integration</h3>
        <div className="mt-4 flex justify-center">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-2">
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z" fill="#E01E5A"/></svg>
        <h3 className="text-lg font-semibold text-foreground">Slack Integration</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Connect your Slack workspace to receive test failure alerts in your channels.</p>

      {slackData.connected ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-success/5 rounded-lg border border-success/20">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <span className="text-success font-medium">Connected to Slack</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><label className="text-muted-foreground">Workspace</label><p className="font-medium text-foreground">{slackData.workspace_name}</p></div>
            <div><label className="text-muted-foreground">Connected At</label><p className="font-medium text-foreground">{slackData.connected_at ? formatDate(slackData.connected_at) : '-'}</p></div>
          </div>
          {slackData.channels && slackData.channels.length > 0 && (
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Channels available for alerts:</label>
              <div className="flex flex-wrap gap-2">
                {slackData.channels.map(channel => (
                  <span key={channel.id} className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-sm">
                    {channel.is_private ? '\uD83D\uDD12' : '#'} {channel.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="pt-2 border-t border-border">
            <Button variant="outline" onClick={handleDisconnect} disabled={disconnectMutation.isPending} className="border-destructive text-destructive hover:bg-destructive/10">
              {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect Slack'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Link2 className="h-5 w-5 text-muted-foreground" />
            <span className="text-muted-foreground">Not connected</span>
          </div>
          <div className="bg-warning/5 rounded-lg p-4 border border-warning/20">
            <p className="text-sm text-warning mb-3"><strong>Development Mode:</strong> This simulates a Slack OAuth connection.</p>
            <div className="space-y-3">
              <div>
                <label htmlFor="workspace-name" className="block text-sm font-medium text-foreground mb-1">Workspace Name</label>
                <input id="workspace-name" type="text" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="Dev Workspace" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <Button onClick={handleConnect} disabled={connectMutation.isPending} className="bg-[#4A154B] text-white hover:bg-[#611f64]">
                {connectMutation.isPending ? 'Connecting...' : 'Connect to Slack'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SlackIntegrationSection;
