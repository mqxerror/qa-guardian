import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

// Feature #1296: Public Status Page
export function PublicStatusPage() {
  const { slug } = useParams<{ slug: string }>();
  const [statusData, setStatusData] = useState<{
    name: string;
    slug: string;
    description?: string;
    logo_url?: string;
    primary_color?: string;
    overall_status: 'up' | 'down' | 'degraded';
    checks: {
      id: string;
      type: string;
      name: string;
      status: 'up' | 'down' | 'degraded' | 'unknown';
      uptime?: number;
      avg_response_time?: number;
    }[];
    incidents?: {
      id: string;
      status: string;
      started_at: string;
      ended_at?: string;
      error?: string;
      check_name: string;
    }[];
    manual_incidents?: {
      id: string;
      title: string;
      status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
      impact: 'none' | 'minor' | 'major' | 'critical';
      updates: {
        id: string;
        status: string;
        message: string;
        created_at: string;
      }[];
      created_at: string;
      updated_at: string;
      resolved_at?: string;
    }[];
    last_updated: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe modal state
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [subscribeEmail, setSubscribeEmail] = useState('');
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [subscribeResult, setSubscribeResult] = useState<{
    success: boolean;
    message: string;
    verification_required?: boolean;
    already_subscribed?: boolean;
    dev_verify_url?: string;
  } | null>(null);

  useEffect(() => {
    const fetchStatusPage = async () => {
      if (!slug) return;
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/v1/status/${slug}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('Status page not found');
          } else if (response.status === 403) {
            setError('This status page is private');
          } else {
            setError('Failed to load status page');
          }
          return;
        }
        const data = await response.json();
        setStatusData(data);
      } catch (err) {
        console.error('Failed to fetch status page:', err);
        setError('Failed to load status page');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatusPage();
    // Refresh every 60 seconds
    const interval = setInterval(fetchStatusPage, 60000);
    return () => clearInterval(interval);
  }, [slug]);

  // Handle subscription
  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !subscribeEmail) return;

    setSubscribeLoading(true);
    setSubscribeResult(null);

    try {
      const response = await fetch(`/api/v1/status/${slug}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: subscribeEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        setSubscribeResult({
          success: true,
          message: data.message,
          verification_required: data.verification_required,
          already_subscribed: data.already_subscribed,
          dev_verify_url: data.dev_verify_url,
        });
        if (!data.verification_required) {
          setSubscribeEmail('');
        }
      } else {
        setSubscribeResult({
          success: false,
          message: data.error || 'Failed to subscribe',
        });
      }
    } catch (err) {
      setSubscribeResult({
        success: false,
        message: 'Network error. Please try again.',
      });
    } finally {
      setSubscribeLoading(false);
    }
  };

  // Handle verification (for dev mode)
  const handleVerify = async () => {
    if (!subscribeResult?.dev_verify_url) return;

    try {
      const response = await fetch(subscribeResult.dev_verify_url);
      const data = await response.json();

      if (response.ok) {
        setSubscribeResult({
          success: true,
          message: data.message || 'Subscription verified! You will now receive incident notifications.',
        });
        setSubscribeEmail('');
      }
    } catch (err) {
      console.error('Verification failed:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (error || !statusData) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="text-6xl mb-4">😕</div>
        <h1 className="text-2xl font-bold text-foreground">{error || 'Status page not found'}</h1>
        <Link
          to="/"
          className="mt-6 rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go Home
        </Link>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'up': return 'bg-green-500';
      case 'down': return 'bg-red-500';
      case 'degraded': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'up': return 'Operational';
      case 'down': return 'Down';
      case 'degraded': return 'Degraded';
      default: return 'Unknown';
    }
  };

  const getOverallStatusBanner = (status: string) => {
    switch (status) {
      case 'up': return { bg: 'bg-green-50 dark:bg-green-950', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-300', icon: '✓', message: 'All Systems Operational' };
      case 'down': return { bg: 'bg-red-50 dark:bg-red-950', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300', icon: '✕', message: 'System Outage' };
      case 'degraded': return { bg: 'bg-yellow-50 dark:bg-yellow-950', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-700 dark:text-yellow-300', icon: '⚠', message: 'Partial System Outage' };
      default: return { bg: 'bg-gray-50 dark:bg-gray-900', border: 'border-gray-200 dark:border-gray-700', text: 'text-gray-700 dark:text-gray-300', icon: '?', message: 'Status Unknown' };
    }
  };

  const overallBanner = getOverallStatusBanner(statusData.overall_status);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header
        className="border-b border-border py-6"
        style={{ backgroundColor: statusData.primary_color ? `${statusData.primary_color}10` : undefined }}
      >
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {statusData.logo_url && (
                <img src={statusData.logo_url} alt={statusData.name} className="h-10 w-10 rounded" />
              )}
              <div>
                <h1 className="text-2xl font-bold text-foreground">{statusData.name}</h1>
                {statusData.description && (
                  <p className="text-sm text-muted-foreground mt-1">{statusData.description}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowSubscribeModal(true)}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 text-sm font-medium"
            >
              <span>🔔</span>
              Subscribe
            </button>
          </div>
        </div>
      </header>

      {/* Subscribe Modal */}
      {showSubscribeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">Subscribe to Updates</h2>
              <button
                onClick={() => {
                  setShowSubscribeModal(false);
                  setSubscribeResult(null);
                  setSubscribeEmail('');
                }}
                className="text-muted-foreground hover:text-foreground text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <p className="text-muted-foreground mb-4">
              Get notified via email when incidents are reported or resolved for {statusData.name}.
            </p>

            {subscribeResult ? (
              <div className={`p-4 rounded-md mb-4 ${
                subscribeResult.success
                  ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
              }`}>
                <p className={subscribeResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                  {subscribeResult.message}
                </p>
                {subscribeResult.dev_verify_url && subscribeResult.verification_required && (
                  <button
                    onClick={handleVerify}
                    className="mt-2 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Verify Now (Dev Mode)
                  </button>
                )}
              </div>
            ) : null}

            {!subscribeResult?.success && (
              <form onSubmit={handleSubscribe}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-foreground mb-1">Email Address</label>
                  <input
                    type="email"
                    value={subscribeEmail}
                    onChange={(e) => setSubscribeEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSubscribeModal(false);
                      setSubscribeResult(null);
                      setSubscribeEmail('');
                    }}
                    className="px-4 py-2 rounded-md border border-border text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={subscribeLoading || !subscribeEmail}
                    className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {subscribeLoading ? 'Subscribing...' : 'Subscribe'}
                  </button>
                </div>
              </form>
            )}

            {subscribeResult?.success && !subscribeResult?.verification_required && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowSubscribeModal(false);
                    setSubscribeResult(null);
                    setSubscribeEmail('');
                  }}
                  className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Overall Status Banner */}
        <div className={`rounded-lg border ${overallBanner.border} ${overallBanner.bg} p-6 mb-8`}>
          <div className="flex items-center gap-3">
            <span className={`text-2xl ${overallBanner.text}`}>{overallBanner.icon}</span>
            <span className={`text-xl font-semibold ${overallBanner.text}`}>{overallBanner.message}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Last updated: {new Date(statusData.last_updated).toLocaleString()}
          </p>
        </div>

        {/* Checks List */}
        <div className="rounded-lg border border-border bg-card overflow-hidden mb-8">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h2 className="font-semibold text-foreground">Services</h2>
          </div>
          <div className="divide-y divide-border">
            {statusData.checks.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                No services configured for this status page
              </div>
            ) : (
              statusData.checks.map(check => (
                <div key={check.id} className="px-4 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(check.status)}`} />
                    <span className="font-medium text-foreground">{check.name}</span>
                    <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
                      {check.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    {check.uptime !== undefined && (
                      <span className="text-sm text-muted-foreground">
                        {check.uptime}% uptime
                      </span>
                    )}
                    {check.avg_response_time !== undefined && (
                      <span className="text-sm text-muted-foreground">
                        {check.avg_response_time}ms
                      </span>
                    )}
                    <span className={`text-sm font-medium ${
                      check.status === 'up' ? 'text-green-600' :
                      check.status === 'down' ? 'text-red-600' :
                      check.status === 'degraded' ? 'text-yellow-600' :
                      'text-gray-500'
                    }`}>
                      {getStatusText(check.status)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Manual Incidents - Communication Posts */}
        {statusData.manual_incidents && statusData.manual_incidents.length > 0 && (
          <div className="rounded-lg border border-border bg-card overflow-hidden mb-8">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <h2 className="font-semibold text-foreground">📢 Incident Communications</h2>
            </div>
            <div className="divide-y divide-border">
              {statusData.manual_incidents.map(incident => (
                <div key={incident.id} className="px-4 py-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        incident.impact === 'critical' ? 'bg-red-100 text-red-800' :
                        incident.impact === 'major' ? 'bg-orange-100 text-orange-800' :
                        incident.impact === 'minor' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {incident.impact.toUpperCase()}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        incident.status === 'resolved' ? 'bg-green-100 text-green-800' :
                        incident.status === 'monitoring' ? 'bg-blue-100 text-blue-800' :
                        incident.status === 'identified' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {incident.status.charAt(0).toUpperCase() + incident.status.slice(1)}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(incident.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-medium text-foreground">{incident.title}</h3>

                  {incident.updates && incident.updates.length > 0 && (
                    <div className="mt-3 space-y-3">
                      {incident.updates.slice().reverse().map((update, idx) => (
                        <div key={update.id || idx} className="pl-4 border-l-2 border-border">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className={`font-medium ${
                              update.status === 'resolved' ? 'text-green-600' :
                              update.status === 'monitoring' ? 'text-blue-600' :
                              update.status === 'identified' ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {update.status.charAt(0).toUpperCase() + update.status.slice(1)}
                            </span>
                            <span>•</span>
                            <span>{new Date(update.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-foreground mt-1">{update.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Auto-detected Incidents */}
        {statusData.incidents && statusData.incidents.length > 0 && (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <h2 className="font-semibold text-foreground">Recent Monitoring Incidents</h2>
            </div>
            <div className="divide-y divide-border">
              {statusData.incidents.map(incident => (
                <div key={incident.id} className="px-4 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground">{incident.check_name}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      incident.ended_at ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {incident.ended_at ? 'Resolved' : 'Ongoing'}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Started: {new Date(incident.started_at).toLocaleString()}
                    {incident.ended_at && (
                      <span className="ml-4">
                        Resolved: {new Date(incident.ended_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {incident.error && (
                    <p className="text-sm text-red-600 mt-2">{incident.error}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground mt-8 pt-8 border-t border-border">
          <p>Powered by <span style={{ color: statusData.primary_color }}>QA Guardian</span></p>
        </div>
      </main>
    </div>
  );
}

export default PublicStatusPage;
