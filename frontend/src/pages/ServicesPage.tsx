// ServicesPage - Platform Services Dashboard
// Feature #2128: Services Dashboard page with card grid layout
// Feature #2130: Auto-refresh, health history dots, toast notifications
// Feature #712: Migrated from raw fetch() to React Query

import { useState, useEffect, useRef } from 'react';
import { ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { Button } from '@/components/ui/button';
import { toast } from '../stores/toastStore';
// Feature #712: React Query hook for services status
import { useServicesStatus, type ServiceInfo, type ServicesResponse } from '../hooks/api/useServices';

type HealthStatus = 'healthy' | 'degraded' | 'unavailable' | 'not_configured';

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; icon: string; dotColor: string }> = {
  healthy: { color: 'text-success', bg: 'bg-success/20', label: 'Healthy', icon: '\u2713', dotColor: 'bg-success' },
  degraded: { color: 'text-warning', bg: 'bg-warning/20', label: 'Degraded', icon: '!', dotColor: 'bg-warning' },
  unavailable: { color: 'text-destructive', bg: 'bg-destructive/20', label: 'Unavailable', icon: '\u2715', dotColor: 'bg-destructive' },
  not_configured: { color: 'text-muted-foreground', bg: 'bg-muted', label: 'Not Configured', icon: '\u2014', dotColor: 'bg-muted-foreground' },
};

const CAPABILITY_STATUS_CONFIG: Record<string, { color: string; icon: string }> = {
  implemented: { color: 'text-success', icon: '\u25cf' },
  simulated: { color: 'text-warning', icon: '\u25d0' },
  planned: { color: 'text-muted-foreground', icon: '\u25cb' },
  not_available: { color: 'text-destructive', icon: '\u2715' },
};

const CATEGORY_ICONS: Record<string, string> = {
  'Infrastructure': '\ud83c\udfd7\ufe0f',
  'Testing Tools': '\ud83e\uddea',
  'Security Scanners': '\ud83d\udee1\ufe0f',
  'AI & Integration': '\ud83e\udd16',
  'Real-Time': '\u26a1',
};

const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds
const MAX_HISTORY = 10;

function HealthHistoryDots({ history }: { history: HealthStatus[] }) {
  if (history.length === 0) return null;
  return (
    <div className="flex items-center gap-0.5 mt-2" title={`Last ${history.length} checks`}>
      {history.map((status, i) => {
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.unavailable;
        return (
          <span
            key={i}
            className={`inline-block w-2 h-2 rounded-full ${config.dotColor} ${i === history.length - 1 ? 'ring-1 ring-offset-1 ring-border' : ''}`}
            title={`Check ${i + 1}: ${config.label}`}
          />
        );
      })}
      <span className="text-[10px] text-muted-foreground ml-1">
        {history.length}/{MAX_HISTORY}
      </span>
    </div>
  );
}

function ServiceCard({ service, history }: { service: ServiceInfo; history: HealthStatus[] }) {
  const statusConfig = STATUS_CONFIG[service.status] || STATUS_CONFIG.unavailable;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-card rounded-lg border border-border p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground truncate">{service.name}</h4>
          {service.version && (
            <p className="text-xs text-muted-foreground mt-0.5">{service.version.match(/^[vV\d]/) ? service.version : `v${service.version}`}</p>
          )}
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}>
          <span className="font-bold">{statusConfig.icon}</span>
          {statusConfig.label}
        </span>
      </div>

      {service.latency_ms !== null && service.latency_ms > 0 && (
        <p className="text-xs text-muted-foreground mb-2">
          Latency: {service.latency_ms}ms
        </p>
      )}

      {service.error && (
        <p className="text-xs text-destructive mb-2 truncate" title={service.error}>
          {service.error}
        </p>
      )}

      {/* Docker container info */}
      {service.container ? (
        <div className="mb-2 p-2 bg-muted/50 rounded border border-border">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs">🐳</span>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${
              service.container.container_status === 'running' ? 'bg-success' :
              service.container.container_status === 'restarting' ? 'bg-warning' : 'bg-destructive'
            }`} />
            <span className="text-xs font-medium text-foreground capitalize">
              {service.container.container_status}
            </span>
            <span className="text-[10px] text-muted-foreground ml-auto">{service.container.uptime}</span>
          </div>
          <div className="text-[10px] text-muted-foreground space-y-0.5">
            <div className="truncate" title={service.container.image}>
              <span className="text-muted-foreground">Image:</span> {service.container.image}
            </div>
            {service.container.ports && (
              <div className="truncate" title={service.container.ports}>
                <span className="text-muted-foreground">Ports:</span> {service.container.ports}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-2 text-[10px] text-muted-foreground flex items-center gap-1">
          <span>🐳</span> No container
        </div>
      )}

      <Button
        variant="link"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="text-xs px-0 h-auto flex items-center gap-1 mt-1"
      >
        <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        {service.capabilities.length} capabilities
      </Button>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-border">
          <ul className="space-y-1">
            {service.capabilities.map((cap) => {
              const capConfig = CAPABILITY_STATUS_CONFIG[cap.status] || CAPABILITY_STATUS_CONFIG.planned;
              return (
                <li key={cap.name} className="flex items-center gap-2 text-xs">
                  <span className={capConfig.color}>{capConfig.icon}</span>
                  <span className="text-foreground">{cap.name}</span>
                  <span className="text-muted-foreground ml-auto capitalize">{cap.status.replace('_', ' ')}</span>
                </li>
              );
            })}
          </ul>
          {service.details && service.details.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-1">Details</p>
              {service.details.map((d) => (
                <div key={d.label} className="flex items-start gap-1 text-xs mb-0.5">
                  <span className="text-muted-foreground min-w-[100px]">{d.label}:</span>
                  <span className="text-foreground">{d.value}</span>
                </div>
              ))}
            </div>
          )}
          {service.config_hints && service.config_hints.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Config: {service.config_hints.join(', ')}
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Checked: {new Date(service.last_checked).toLocaleTimeString()}
          </p>
        </div>
      )}

      {/* Health history dots */}
      <HealthHistoryDots history={history} />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-20 bg-muted rounded-lg flex-1" />
        ))}
      </div>
      {[1, 2, 3].map(g => (
        <div key={g}>
          <div className="h-6 bg-muted rounded w-40 mb-3" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(c => (
              <div key={c} className="h-28 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ServicesPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [nextRefreshIn, setNextRefreshIn] = useState(AUTO_REFRESH_INTERVAL / 1000);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousStatusRef = useRef<Record<string, HealthStatus>>({});
  const [healthHistory, setHealthHistory] = useState<Record<string, HealthStatus[]>>({});

  // Feature #712: React Query hook for services status with auto-refresh
  const {
    data,
    isLoading: loading,
    error: queryError,
    refetch,
    dataUpdatedAt,
  } = useServicesStatus({
    refetchInterval: autoRefresh ? AUTO_REFRESH_INTERVAL : false,
  });

  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to load services') : null;

  // Handle status change notifications when data updates
  useEffect(() => {
    if (!data) return;

    // Check for status changes and show toast notifications
    const prevStatuses = previousStatusRef.current;
    data.services.forEach((service) => {
      const prev = prevStatuses[service.name];
      if (prev && prev !== service.status) {
        const wasHealthy = prev === 'healthy';
        const isHealthy = service.status === 'healthy';
        if (wasHealthy && !isHealthy) {
          toast.error(`${service.name} is now ${service.status}`);
        } else if (!wasHealthy && isHealthy) {
          toast.success(`${service.name} is now healthy`);
        }
      }
    });

    // Update previous statuses
    const newStatuses: Record<string, HealthStatus> = {};
    data.services.forEach((s) => { newStatuses[s.name] = s.status; });
    previousStatusRef.current = newStatuses;

    // Update health history (last MAX_HISTORY checks per service)
    setHealthHistory((prev) => {
      const updated = { ...prev };
      data.services.forEach((s) => {
        const existing = updated[s.name] || [];
        updated[s.name] = [...existing, s.status].slice(-MAX_HISTORY);
      });
      return updated;
    });

    // Reset countdown on data update
    setNextRefreshIn(AUTO_REFRESH_INTERVAL / 1000);
  }, [data, dataUpdatedAt]);

  // Countdown timer
  useEffect(() => {
    if (autoRefresh) {
      countdownRef.current = setInterval(() => {
        setNextRefreshIn((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [autoRefresh]);

  // Group services by category
  const groupedServices = data?.services.reduce<Record<string, ServiceInfo[]>>((acc, service) => {
    const cat = service.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(service);
    return acc;
  }, {}) || {};

  // Sort categories in desired order
  const categoryOrder = ['Infrastructure', 'Testing Tools', 'Security Scanners', 'AI & Integration', 'Real-Time'];
  const sortedCategories = Object.keys(groupedServices).sort(
    (a, b) => (categoryOrder.indexOf(a) === -1 ? 99 : categoryOrder.indexOf(a)) - (categoryOrder.indexOf(b) === -1 ? 99 : categoryOrder.indexOf(b))
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Feature #640: PageHeader component */}
        <PageHeader
          title="Platform Services"
          description={data ? `${data.healthy_count} of ${data.total_services} services healthy` : 'Monitoring platform service health'}
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'Monitoring', href: '/ai-router' },
            { label: 'Services' }
          ]}
          actions={
            <div className="flex items-center gap-3">
              {/* Auto-refresh toggle */}
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => {
                    setAutoRefresh(e.target.checked);
                    if (e.target.checked) setNextRefreshIn(AUTO_REFRESH_INTERVAL / 1000);
                  }}
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                />
                Auto-refresh
                {autoRefresh && <span className="text-muted-foreground">({nextRefreshIn}s)</span>}
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          }
        />
        {/* Status indicator */}
        {data && (
          <div className="mb-4 text-sm">
            <span className={
              data.overall_status === 'operational' ? 'text-success' :
              data.overall_status === 'degraded' ? 'text-warning' :
              'text-destructive'
            }>
              {data.overall_status === 'operational' ? 'All Systems Operational' :
               data.overall_status === 'degraded' ? 'Some Systems Degraded' : 'System Issues Detected'}
            </span>
          </div>
        )}

        {/* Summary cards */}
        {data && !loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-success/10 border border-success/30 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-success">{data.healthy_count}</p>
              <p className="text-xs text-success">Healthy</p>
            </div>
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-warning">{data.degraded_count}</p>
              <p className="text-xs text-warning">Degraded</p>
            </div>
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-destructive">{data.unavailable_count}</p>
              <p className="text-xs text-destructive">Unavailable</p>
            </div>
            <div className="bg-muted/50 border border-border rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-muted-foreground">{data.not_configured_count}</p>
              <p className="text-xs text-muted-foreground">Not Configured</p>
            </div>
          </div>
        )}

        {/* Content */}
        {loading && !data && <LoadingSkeleton />}

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
            <Button variant="link" onClick={() => refetch()} className="mt-2 text-sm text-destructive px-0">
              Try Again
            </Button>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {sortedCategories.map(category => (
              <div key={category}>
                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span>{CATEGORY_ICONS[category] || '\ud83d\udce6'}</span>
                  {category}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({groupedServices[category].filter(s => s.status === 'healthy').length}/{groupedServices[category].length} healthy)
                  </span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupedServices[category].map(service => (
                    <ServiceCard
                      key={service.name}
                      service={service}
                      history={healthHistory[service.name] || []}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {data && (
          <p className="text-xs text-muted-foreground mt-6 text-center">
            Last checked: {new Date(data.checked_at).toLocaleString()}
            {autoRefresh && ' \u2022 Auto-refreshing every 30s'}
          </p>
        )}
      </div>
    </Layout>
  );
}
