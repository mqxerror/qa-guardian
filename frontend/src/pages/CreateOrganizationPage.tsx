// Feature #1357: Extracted CreateOrganizationPage for code quality compliance (400 line limit)
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import { getErrorMessage } from '../utils/errorHandling';

export function CreateOrganizationPage() {
  const navigate = useNavigate();
  const { token, user, setUser } = useAuthStore();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [autoSlug, setAutoSlug] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

    setIsLoading(true);

    try {
      const response = await fetch('/api/v1/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create organization');
      }

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
    } catch (err) {
      // Use enhanced error handling for network errors
      setError(getErrorMessage(err, 'Failed to create organization. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-foreground">Create Organization</h2>
          <p className="mt-2 text-muted-foreground">
            Set up your organization to start managing tests
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="org-name" className="mb-1 block text-sm font-medium text-foreground">
              Organization Name
            </label>
            <input
              id="org-name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g., Acme Inc."
              required
              maxLength={100}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">{name.length}/100 characters</p>
          </div>
          <div>
            <label htmlFor="org-slug" className="mb-1 block text-sm font-medium text-foreground">
              Organization Slug
            </label>
            <input
              id="org-slug"
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="e.g., acme-inc"
              required
              pattern="[a-z0-9-]+"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              URL-friendly identifier (lowercase letters, numbers, and hyphens only)
            </p>
          </div>
          <button
            type="submit"
            disabled={isLoading || !name.trim() || !slug.trim()}
            className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'Create Organization'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an organization?{' '}
          <Link to="/dashboard" className="text-primary hover:underline">
            Go to Dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
