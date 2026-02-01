// Container Image Scanning - Coming Soon placeholder
// Real container scanning will require Trivy/Docker integration
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';

export function ContainerScanPage() {
  const navigate = useNavigate();
  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate('/security')} className="text-muted-foreground hover:text-foreground">
            &larr;
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Container Image Scanning</h1>
            <p className="text-muted-foreground">Scan Docker images for vulnerabilities</p>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <span className="text-5xl mb-4 block">🐳</span>
          <h2 className="text-xl font-semibold text-foreground mb-2">Coming Soon</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Container image scanning with real Trivy integration is planned for a future release.
            This will scan Docker images for vulnerabilities in base images and application dependencies.
          </p>
        </div>
      </div>
    </Layout>
  );
}
