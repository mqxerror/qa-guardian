// ServicesPage - Platform Services Dashboard
// Feature #2128: Services Dashboard page with card grid layout

import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';

interface ServiceCapability {
  name: string;
  status: 'implemented' | 'simulated' | 'planned' | 'not_available';
}

interface ServiceInfo {
  name: string;
  category: string;
  status: 'healthy' | 'degraded' | 'unavailable' | 'not_configured';
  latency_ms: number | null;
  version: string | null;
  last_checked: string;
  error?: string;
  capabilities: ServiceCapability[];
  config_hints?: string[];
  details?: { label: string; value: string }[];
}

interface ServicesResponse {
  overall_status: string;
  total_services: number;
  healthy_count: number;
  degraded_count: number;
  unavailable_count: number;
  not_configured_count: number;
  checked_at: string;
  services: ServiceInfo[];
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  healthy: { color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Healthy', icon: '✓' },
  degraded: { color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Degraded', icon: '!' },
  unavailable: { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Unavailable', icon: '✕' },
  not_configured: { color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', label: 'Not Configured', icon: '—' },
};

const CAPABILITY_STATUS_CONFIG: Record<string, { color: string; icon: string }> = {
  implemented: { color: 'text-green-600 dark:text-green-400', icon: '●' },
  simulated: { color: 'text-yellow-600 dark:text-yellow-400', icon: '◐' },
  planned: { color: 'text-gray-400 dark:text-gray-500', icon: '○' },
  not_available: { color: 'text-red-400 dark:text-red-500', icon: '✕' },
};

const CATEGORY_ICONS: Record<string, string> = {
  'Infrastructure': '🏗️',
  'Testing Tools': '🧪',
  'Security Scanners': '🛡️',
  'AI & Integration': '🤖',
  'Real-Time': '⚡',
};

function ServiceCard({ service }: { service: ServiceInfo }) {
  const statusConfig = STATUS_CONFIG[service.status] || STATUS_CONFIG.unavailable;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{service.name}</h4>
          {service.version && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{service.version.match(/^[vV\d]/) ? service.version : `v${service.version}`}</p>
          )}
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}>
          <span className="font-bold">{statusConfig.icon}</span>
          {statusConfig.label}
        </span>
      </div>

      {service.latency_ms !== null && service.latency_ms > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Latency: {service.latency_ms}ms
        </p>
      )}

      {service.error && (
        <p className="text-xs text-red-500 dark:text-red-400 mb-2 truncate" title={service.error}>
          {service.error}
        </p>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-1"
      >
        <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {service.capabilities.length} capabilities
      </button>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <ul className="space-y-1">
            {service.capabilities.map((cap) => {
              const capConfig = CAPABILITY_STATUS_CONFIG[cap.status] || CAPABILITY_STATUS_CONFIG.planned;
              return (
                <li key={cap.name} className="flex items-center gap-2 text-xs">
                  <span className={capConfig.color}>{capConfig.icon}</span>
                  <span className="text-gray-700 dark:text-gray-300">{cap.name}</span>
                  <span className="text-gray-400 dark:text-gray-500 ml-auto capitalize">{cap.status.replace('_', ' ')}</span>
                </li>
              );
            })}
          </ul>
          {service.details && service.details.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Details</p>
              {service.details.map((d) => (
                <div key={d.label} className="flex items-start gap-1 text-xs mb-0.5">
                  <span className="text-gray-500 dark:text-gray-400 min-w-[100px]">{d.label}:</span>
                  <span className="text-gray-700 dark:text-gray-300">{d.value}</span>
                </div>
              ))}
            </div>
          )}
          {service.config_hints && service.config_hints.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Config: {service.config_hints.join(', ')}
              </p>
            </div>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Checked: {new Date(service.last_checked).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg flex-1" />
        ))}
      </div>
      {[1, 2, 3].map(g => (
        <div key={g}>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-3" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(c => (
              <div key={c} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ServicesPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<ServicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/v1/services/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch services: ${response.status} ${response.statusText}`);
      }
      const json = await response.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [token]);

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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Platform Services</h2>
            {data && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {data.healthy_count} of {data.total_services} services healthy
                {' — '}
                <span className={
                  data.overall_status === 'operational' ? 'text-green-600 dark:text-green-400' :
                  data.overall_status === 'degraded' ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-red-600 dark:text-red-400'
                }>
                  {data.overall_status === 'operational' ? 'All Systems Operational' :
                   data.overall_status === 'degraded' ? 'Some Systems Degraded' : 'System Issues Detected'}
                </span>
              </p>
            )}
          </div>
          <button
            onClick={fetchServices}
            disabled={loading}
            className="mt-2 sm:mt-0 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Summary cards */}
        {data && !loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">{data.healthy_count}</p>
              <p className="text-xs text-green-600 dark:text-green-500">Healthy</p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{data.degraded_count}</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-500">Degraded</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">{data.unavailable_count}</p>
              <p className="text-xs text-red-600 dark:text-red-500">Unavailable</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-700 dark:text-gray-400">{data.not_configured_count}</p>
              <p className="text-xs text-gray-600 dark:text-gray-500">Not Configured</p>
            </div>
          </div>
        )}

        {/* Content */}
        {loading && <LoadingSkeleton />}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
            <button onClick={fetchServices} className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline">
              Try Again
            </button>
          </div>
        )}

        {!loading && data && (
          <div className="space-y-6">
            {sortedCategories.map(category => (
              <div key={category}>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                  <span>{CATEGORY_ICONS[category] || '📦'}</span>
                  {category}
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                    ({groupedServices[category].filter(s => s.status === 'healthy').length}/{groupedServices[category].length} healthy)
                  </span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupedServices[category].map(service => (
                    <ServiceCard key={service.name} service={service} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {data && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-6 text-center">
            Last checked: {new Date(data.checked_at).toLocaleString()}
          </p>
        )}
      </div>
    </Layout>
  );
}
