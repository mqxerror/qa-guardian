// npm Audit Page - Coming Soon placeholder
// Real npm audit will require backend integration with npm CLI
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';

export function NpmAuditPage() {
  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
        {/* Feature #639: PageHeader component */}
        <PageHeader
          title="npm Audit"
          description="Audit npm dependencies for known vulnerabilities"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Security', href: '/security' }, { label: 'npm Audit' }]}
        />
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <span className="text-5xl mb-4 block">📦</span>
          <h2 className="text-xl font-semibold text-foreground mb-2">Coming Soon</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            npm audit integration with real dependency scanning is planned for a future release.
            This will run npm audit against your project dependencies and report vulnerabilities.
          </p>
        </div>
      </div>
    </Layout>
  );
}
