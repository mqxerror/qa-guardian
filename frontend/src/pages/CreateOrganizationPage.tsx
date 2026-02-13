// Feature #338: Dark-first auth page with premium design
// Feature #402: Lazy-load framer-motion for reduced bundle size
// Feature #711: Migrated to React Query - useCreateOrganization hook
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LazyMotionWrapper, m } from '../components/LazyMotion';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import { getErrorMessage } from '../utils/errorHandling';
import { BackgroundBeams, Input } from '../components/aceternity';
import { Building2, ArrowRight, Loader2 } from 'lucide-react';
import { useReducedMotion } from '../components/ui';
import { useCreateOrganization } from '../hooks/api/useOrganization';

export function CreateOrganizationPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [autoSlug, setAutoSlug] = useState(true);
  const [error, setError] = useState('');
  const prefersReducedMotion = useReducedMotion();

  // React Query mutation for creating organization
  const createOrgMutation = useCreateOrganization();
  const isLoading = createOrgMutation.isPending;

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (autoSlug) {
      setSlug(generateSlug(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
    setAutoSlug(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Organization name is required');
      return;
    }

    if (!slug.trim()) {
      setError('Organization slug is required');
      return;
    }

    createOrgMutation.mutate(
      { name: name.trim(), slug: slug.trim() },
      {
        onSuccess: (data) => {
          // Update the user's organization_id in auth store
          if (user && data.organization) {
            setUser({
              ...user,
              organization_id: data.organization.id,
              role: 'owner',
            });
          }
          toast.success(`Organization "${data.organization.name}" created successfully!`);
          navigate('/dashboard');
        },
        onError: (err) => {
          setError(getErrorMessage(err, 'Failed to create organization. Please try again.'));
        },
      }
    );
  };

  return (
    <LazyMotionWrapper>
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      {/* Background Effects */}
      <BackgroundBeams className="opacity-40" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      <m.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="rounded-2xl border border-border bg-card/80 p-8 shadow-2xl backdrop-blur-sm">
          {/* Header */}
          <div className="mb-8 text-center">
            <m.div
              initial={prefersReducedMotion ? {} : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20"
            >
              <Building2 className="h-6 w-6 text-primary" />
            </m.div>
            <m.h2
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-3xl font-bold text-transparent"
            >
              Create Organization
            </m.h2>
            <m.p
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-2 text-muted-foreground"
            >
              Set up your organization to start managing tests
            </m.p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Error Alert */}
            {error && (
              <m.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </m.div>
            )}

            {/* Organization Name Input */}
            <m.div
              initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Input
                id="org-name"
                type="text"
                label="Organization Name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Acme Inc."
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">{name.length}/100 characters</p>
            </m.div>

            {/* Organization Slug Input */}
            <m.div
              initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 }}
            >
              <Input
                id="org-slug"
                type="text"
                label="Organization Slug"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="e.g., acme-inc"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                URL-friendly identifier (lowercase letters, numbers, and hyphens only)
              </p>
            </m.div>

            {/* Submit Button */}
            <m.div
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <button
                type="submit"
                disabled={isLoading || !name.trim() || !slug.trim()}
                className="group relative w-full overflow-hidden rounded-lg bg-gradient-to-r from-primary to-primary px-4 py-3 font-medium text-primary-foreground transition-all hover:from-primary hover:to-primary/80 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Organization</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </span>
              </button>
            </m.div>
          </form>

          {/* Dashboard Link */}
          <m.div
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 text-center text-sm text-muted-foreground"
          >
            Already have an organization?{' '}
            <Link to="/dashboard" className="text-primary hover:text-primary/70 transition-colors font-medium">
              Go to Dashboard
            </Link>
          </m.div>
        </div>
      </m.div>
    </div>
    </LazyMotionWrapper>
  );
}
