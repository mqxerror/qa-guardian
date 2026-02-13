// Trivy Dependency Scan Page - Coming Soon placeholder
// Real Trivy scanning will require backend integration with Trivy CLI
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';
// Feature #728: EmptyState adoption
import { EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';

export function TrivyDependencyScanPage() {
  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
        {/* Feature #639: PageHeader component */}
        <PageHeader
          title="Dependency Scanning"
          description="Scan project dependencies for known vulnerabilities"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Security', href: '/security' }, { label: 'Dependency Scanning' }]}
        />
        {/* Feature #728: EmptyState adoption for Coming Soon placeholder */}
        <EmptyState
          icon={EmptyStateIcons.search}
          title="Coming Soon"
          description="Trivy and Grype dependency scanning integration is planned for a future release. This will scan your project dependencies, generate SBOMs, and provide upgrade recommendations."
        />
      </div>
    </Layout>
  );
}
