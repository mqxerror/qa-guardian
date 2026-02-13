/**
 * Organizations Module - Type Definitions
 * Feature #730: Split organizations.ts into sub-modules
 *
 * Contains all TypeScript interfaces used by organization route handlers.
 */

export interface InvitationBody {
  email: string;
  role: 'admin' | 'developer' | 'viewer';
}

export interface OrgParams {
  id: string;
}

export interface CreateOrganizationBody {
  name: string;
  slug?: string;
  timezone?: string;
}
