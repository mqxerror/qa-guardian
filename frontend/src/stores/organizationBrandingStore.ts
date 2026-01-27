/**
 * Organization Branding Store
 * Feature #1995: Store company branding for use in PDF exports
 *
 * Persists company logo and branding settings that can be used
 * across the application, especially in PDF report exports.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OrganizationBrandingState {
  // Logo stored as base64 data URL for PDF embedding
  logoBase64: string | null;
  // Organization name for branding
  organizationName: string;
  // Methods
  setLogo: (logoBase64: string | null) => void;
  setOrganizationName: (name: string) => void;
  clearBranding: () => void;
}

export const useOrganizationBrandingStore = create<OrganizationBrandingState>()(
  persist(
    (set) => ({
      logoBase64: null,
      organizationName: 'My Organization',

      setLogo: (logoBase64: string | null) => {
        set({ logoBase64 });
      },

      setOrganizationName: (name: string) => {
        set({ organizationName: name });
      },

      clearBranding: () => {
        set({ logoBase64: null, organizationName: 'My Organization' });
      },
    }),
    {
      name: 'qa-guardian-organization-branding',
      version: 1,
    }
  )
);
