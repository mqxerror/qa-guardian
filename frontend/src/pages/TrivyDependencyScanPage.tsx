// Trivy Dependency Scan Page - Coming Soon placeholder
// Real Trivy scanning will require backend integration with Trivy CLI
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';

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
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <span className="text-5xl mb-4 block">🔍</span>
          <h2 className="text-xl font-semibold text-foreground mb-2">Coming Soon</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Trivy and Grype dependency scanning integration is planned for a future release.
            This will scan your project dependencies, generate SBOMs, and provide upgrade recommendations.
          </p>
        </div>
      </div>
    </Layout>
  );
}
