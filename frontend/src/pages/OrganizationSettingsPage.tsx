// OrganizationSettingsPage - Extracted from App.tsx
// Feature #636: Adopt Modal component in page-level inline modals
// Feature #1441: Split App.tsx into logical modules
// Feature #709: Migrate to React Query and extract inline interfaces
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore, Theme } from '../stores/themeStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useTimezoneStore } from '../stores/timezoneStore';
import { useTestDefaultsStore } from '../stores/testDefaultsStore';
import { useOrganizationBrandingStore } from '../stores/organizationBrandingStore';
import { toast } from '../stores/toastStore';
import { Modal, ModalBody, ModalFooter } from '../components/ui/Modal';
import { PageHeader } from '../components/ui';
import { Loader2, X, ImageIcon, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Feature #709: Import React Query hooks (only those used directly in this page)
import {
  useAdminMembers,
  useTransferOwnership,
  useDeleteOrganization,
} from '../hooks/api';

// Agent 7: Import extracted section components
import {
  SessionManagementSection,
  ArtifactRetentionSection,
  StorageUsageSection,
  SlackIntegrationSection,
  MCPConnectionsSection,
  MCPAnalyticsDashboard,
  MCPAuditLogSection,
  MCPToolsCatalogSection,
} from '../components/organization-settings';


function OrganizationSettingsPage() {
 const { logout } = useAuthStore();
 const { theme, setTheme } = useThemeStore();
 const { timezone, setTimezone } = useTimezoneStore();
 const { preferences, setPreference } = useNotificationStore();
 const { defaults, setDefault } = useTestDefaultsStore();
 // Feature #1995: Use organization branding store for logo persistence
 const { logoBase64, organizationName, setLogo, setOrganizationName } = useOrganizationBrandingStore();
 const navigate = useNavigate();

 // Feature #709: Use React Query for admin members and mutations
 const { data: adminMembers = [] } = useAdminMembers();
 const transferOwnershipMutation = useTransferOwnership();
 const deleteOrgMutation = useDeleteOrganization();

 // Modal state
 const [showDeleteModal, setShowDeleteModal] = useState(false);
 const [deletePassword, setDeletePassword] = useState('');
 const [deleteError, setDeleteError] = useState('');
 const [deleteSuccess, setDeleteSuccess] = useState(false);
 const [showTransferModal, setShowTransferModal] = useState(false);
 const [transferPassword, setTransferPassword] = useState('');
 const [transferError, setTransferError] = useState('');
 const [transferSuccess, setTransferSuccess] = useState(false);
 const [selectedNewOwner, setSelectedNewOwner] = useState('');

 // Form state
 const [orgName, setOrgName] = useState(organizationName);
 const [isSaving, setIsSaving] = useState(false);
 const [logoUrl, setLogoUrl] = useState<string | null>(logoBase64);
 const [, setLogoFile] = useState<File | null>(null);

 const handleTransferOwnership = async (e: React.FormEvent) => {
   e.preventDefault();
   setTransferError('');
   try {
     await transferOwnershipMutation.mutateAsync({
       newOwnerId: selectedNewOwner,
       password: transferPassword,
     });
     setTransferSuccess(true);
     toast.success('Ownership transferred successfully!');
     setTimeout(() => { logout(); navigate('/login'); }, 2000);
   } catch (err) {
     setTransferError(err instanceof Error ? err.message : 'Failed to transfer ownership');
   }
 };

 // Feature #1995: Convert logo to base64 and store in branding store
 const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file) {
 const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
 if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
 if (!allowedTypes.includes(file.type)) { toast.error('Please use PNG, JPG, GIF, or WebP'); return; }
 if (file.size > 2 * 1024 * 1024) { toast.error('File too large. Maximum allowed size is 2MB.'); return; }
 setLogoFile(file);

 // Convert to base64 for persistence and PDF embedding
 const reader = new FileReader();
 reader.onload = () => {
 const base64 = reader.result as string;
 setLogoUrl(base64);
 setLogo(base64); // Persist to branding store
 toast.success('Logo uploaded successfully! It will appear in PDF exports.');
 };
 reader.readAsDataURL(file);
 }
 };

 const handleRemoveLogo = () => {
 setLogoFile(null);
 setLogoUrl(null);
 setLogo(null); // Clear from branding store
 toast.success('Logo removed');
 };

 useEffect(() => {
 const handleEscape = (e: KeyboardEvent) => {
 if (e.key === 'Escape' && showDeleteModal && !deleteSuccess) setShowDeleteModal(false);
 };
 document.addEventListener('keydown', handleEscape);
 return () => document.removeEventListener('keydown', handleEscape);
 }, [showDeleteModal, deleteSuccess]);

 const handleSaveSettings = async () => {
 setIsSaving(true);
 await new Promise(resolve => setTimeout(resolve, 500));
 // Feature #1995: Save organization name to branding store
 setOrganizationName(orgName);
 toast.success('Organization settings saved successfully!');
 setIsSaving(false);
 };

 const handleDeleteOrganization = async (e: React.FormEvent) => {
   e.preventDefault();
   setDeleteError('');
   try {
     await deleteOrgMutation.mutateAsync(deletePassword);
     setDeleteSuccess(true);
     setTimeout(() => { logout(); navigate('/login'); }, 2000);
   } catch (err) {
     setDeleteError(err instanceof Error ? err.message : 'Failed to delete organization');
   }
 };

 return (
 <Layout>
 <div className="p-8">
 <PageHeader
   title="Organization Settings"
   description="Manage your organization's settings and configuration."
   breadcrumbs={[
     { label: 'Home', href: '/' },
     { label: 'Settings', href: '/settings' },
     { label: 'Organization' }
   ]}
 />

 <div className="mt-8 max-w-2xl">
 <div className="rounded-lg border border-border bg-card p-6">
 <h3 className="text-lg font-semibold text-foreground">General Settings</h3>
 <div className="mt-4 space-y-4">
 <div>
 <label htmlFor="org-name" className="mb-1 block text-sm font-medium text-foreground">Organization Name</label>
 <input id="org-name" type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground" />
 </div>
 <div>
 <label className="mb-1 block text-sm font-medium text-foreground">Organization Logo</label>
 <div className="flex items-center gap-4">
 {logoUrl ? (
 <div className="relative">
 <img src={logoUrl} alt="Organization logo" className="h-16 w-16 rounded-lg object-cover border border-border" />
 <Button type="button" variant="destructive" size="icon" onClick={handleRemoveLogo} className="absolute -top-2 -right-2 rounded-full h-6 w-6 p-1" aria-label="Remove logo">
 <X className="h-3 w-3" />
 </Button>
 </div>
 ) : (
 <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted">
 <ImageIcon className="h-6 w-6 text-muted-foreground" />
 </div>
 )}
 <div>
 <label htmlFor="logo-upload" className="cursor-pointer rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">{logoUrl ? 'Change Logo' : 'Upload Logo'}</label>
 <input id="logo-upload" type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
 <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, GIF up to 2MB</p>
 </div>
 </div>
 </div>
 <div>
 <label htmlFor="timezone" className="mb-1 block text-sm font-medium text-foreground">Timezone</label>
 <select id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground">
 <option value="UTC">UTC</option>
 <option value="America/New_York">Eastern Time (US)</option>
 <option value="America/Los_Angeles">Pacific Time (US)</option>
 <option value="Europe/London">London (UK)</option>
 <option value="Europe/Paris">Paris (CET)</option>
 <option value="Asia/Tokyo">Tokyo (JST)</option>
 </select>
 </div>
 <Button onClick={handleSaveSettings} disabled={isSaving}>
 {isSaving && <Loader2 aria-hidden="true" className="animate-spin h-4 w-4" />}
 {isSaving ? 'Saving...' : 'Save Changes'}
 </Button>
 </div>
 </div>

 <div className="mt-6 rounded-lg border border-border bg-card p-6">
 <h3 className="text-lg font-semibold text-foreground">User Preferences</h3>
 <div className="mt-4 space-y-4">
 <div>
 <label htmlFor="theme" className="mb-1 block text-sm font-medium text-foreground">Theme</label>
 <p className="text-sm text-muted-foreground mb-2">Choose how QA Guardian looks to you.</p>
 <select id="theme" value={theme} onChange={(e) => setTheme(e.target.value as Theme)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground">
 <option value="system">System (follow device setting)</option>
 <option value="light">Light</option>
 <option value="dark">Dark</option>
 </select>
 </div>
 </div>
 </div>

 <div className="mt-6 rounded-lg border border-border bg-card p-6">
 <h3 className="text-lg font-semibold text-foreground">Notification Preferences</h3>
 <p className="text-sm text-muted-foreground mt-1">Control how and when you receive notifications.</p>
 <div className="mt-4 space-y-4">
 {(['emailNotifications', 'testFailureAlerts', 'scheduleCompletionAlerts', 'weeklyDigest'] as const).map((pref) => (
 <div key={pref} className="flex items-center justify-between">
 <div>
 <label htmlFor={pref} className="text-sm font-medium text-foreground">{pref === 'emailNotifications' ? 'Email Notifications' : pref === 'testFailureAlerts' ? 'Test Failure Alerts' : pref === 'scheduleCompletionAlerts' ? 'Schedule Completion Alerts' : 'Weekly Digest'}</label>
 <p className="text-xs text-muted-foreground">{pref === 'emailNotifications' ? 'Receive notifications via email' : pref === 'testFailureAlerts' ? 'Get notified when tests fail' : pref === 'scheduleCompletionAlerts' ? 'Get notified when scheduled test runs complete' : 'Receive a weekly summary of test results'}</p>
 </div>
 <button id={pref} type="button" role="switch" aria-checked={preferences[pref]} onClick={() => setPreference(pref, !preferences[pref])} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${preferences[pref] ? 'bg-primary' : 'bg-muted'}`}>
 <span className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${preferences[pref] ? 'translate-x-6' : 'translate-x-1'}`} />
 </button>
 </div>
 ))}
 </div>
 </div>

 <div className="mt-6 rounded-lg border border-border bg-card p-6">
 <h3 className="text-lg font-semibold text-foreground">Test Defaults</h3>
 <p className="text-sm text-muted-foreground mt-1">Configure default settings for new tests.</p>
 <div className="mt-4 space-y-4">
 <div>
 <label htmlFor="defaultTimeout" className="mb-1 block text-sm font-medium text-foreground">Default Timeout (ms)</label>
 <input id="defaultTimeout" type="number" min="1000" max="300000" step="1000" value={defaults.defaultTimeout} onChange={(e) => setDefault('defaultTimeout', parseInt(e.target.value, 10) || 30000)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground" />
 <p className="text-xs text-muted-foreground mt-1">Current: {defaults.defaultTimeout / 1000} seconds</p>
 </div>
 <div>
 <label htmlFor="defaultBrowser" className="mb-1 block text-sm font-medium text-foreground">Default Browser</label>
 <select id="defaultBrowser" value={defaults.defaultBrowser} onChange={(e) => setDefault('defaultBrowser', e.target.value as 'chromium' | 'firefox' | 'webkit')} className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground">
 <option value="chromium">Chromium</option>
 <option value="firefox">Firefox</option>
 <option value="webkit">WebKit (Safari)</option>
 </select>
 </div>
 <div>
 <label htmlFor="defaultRetries" className="mb-1 block text-sm font-medium text-foreground">Default Retries</label>
 <input id="defaultRetries" type="number" min="0" max="5" value={defaults.defaultRetries} onChange={(e) => setDefault('defaultRetries', parseInt(e.target.value, 10) || 0)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground" />
 </div>
 </div>
 </div>

 <SessionManagementSection />
 <ArtifactRetentionSection />
 <StorageUsageSection />
 <SlackIntegrationSection />
 <MCPConnectionsSection />
 <MCPAnalyticsDashboard />
 <MCPAuditLogSection />
 <MCPToolsCatalogSection />

 <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-6">
 <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
 <p className="mt-2 text-sm text-muted-foreground">These actions are irreversible. Please be careful.</p>
 <div className="mt-4 flex flex-wrap gap-3">
 {adminMembers.length > 0 && (
 <Button variant="outline" onClick={() => { setShowTransferModal(true); setTransferPassword(''); setTransferError(''); setSelectedNewOwner(adminMembers[0]?.user_id || ''); }} className="border-warning text-warning hover:bg-warning/5">Transfer Ownership</Button>
 )}
 <Button variant="outline" onClick={() => setShowDeleteModal(true)} className="border-destructive text-destructive hover:bg-destructive/10">Delete Organization</Button>
 </div>
 </div>
 </div>

 <Modal
 isOpen={showTransferModal}
 onClose={() => !transferSuccess && setShowTransferModal(false)}
 title="Transfer Ownership"
 size="md"
 >
 <ModalBody>
 {transferSuccess ? (
 <div className="text-center">
 <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10"><Check aria-hidden="true" className="h-6 w-6 text-success" /></div>
 <h3 className="text-lg font-semibold text-foreground">Ownership Transferred</h3>
 <p className="mt-2 text-muted-foreground">Redirecting to login...</p>
 </div>
 ) : (
 <>
 <p className="text-sm text-muted-foreground mb-4">You are about to transfer ownership. You will become an admin.</p>
 {transferError && <div role="alert" className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{transferError}</div>}
 <form id="transfer-ownership-form" onSubmit={handleTransferOwnership} className="space-y-4">
 <div>
 <label htmlFor="new-owner" className="mb-1 block text-sm font-medium text-foreground">New Owner</label>
 <select id="new-owner" value={selectedNewOwner} onChange={(e) => setSelectedNewOwner(e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground">
 {adminMembers.map((admin) => <option key={admin.user_id} value={admin.user_id}>{admin.name} ({admin.email})</option>)}
 </select>
 </div>
 <div>
 <label htmlFor="transfer-password" className="mb-1 block text-sm font-medium text-foreground">Confirm Your Password</label>
 <input id="transfer-password" type="password" value={transferPassword} onChange={(e) => setTransferPassword(e.target.value)} required placeholder="Enter your password" className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground" />
 </div>
 </form>
 </>
 )}
 </ModalBody>
 {!transferSuccess && (
 <ModalFooter>
 <Button type="button" variant="outline" onClick={() => setShowTransferModal(false)}>Cancel</Button>
 <Button type="submit" form="transfer-ownership-form" disabled={transferOwnershipMutation.isPending || !selectedNewOwner || !transferPassword} className="bg-warning text-primary-foreground hover:bg-warning/90">{transferOwnershipMutation.isPending ? 'Transferring...' : 'Transfer Ownership'}</Button>
 </ModalFooter>
 )}
 </Modal>

 <Modal
 isOpen={showDeleteModal}
 onClose={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError(''); }}
 title="Delete Organization"
 size="md"
 >
 <ModalBody>
 {deleteSuccess ? (
 <div className="text-center">
 <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10"><Check aria-hidden="true" className="h-6 w-6 text-success" /></div>
 <h3 className="text-lg font-semibold text-foreground">Organization Deleted</h3>
 <p className="mt-2 text-muted-foreground">Redirecting to login...</p>
 </div>
 ) : (
 <>
 <p className="text-sm text-muted-foreground mb-4">This action <strong>cannot be undone</strong>. This will permanently delete your organization, all projects, test suites, and test results.</p>
 <form id="delete-organization-form" onSubmit={handleDeleteOrganization} className="space-y-4">
 {deleteError && <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{deleteError}</div>}
 <div>
 <label htmlFor="deletePassword" className="mb-1 block text-sm font-medium text-foreground">Enter your password to confirm</label>
 <input id="deletePassword" type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="Enter your password" required autoComplete="current-password" className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground" />
 </div>
 </form>
 </>
 )}
 </ModalBody>
 {!deleteSuccess && (
 <ModalFooter>
 <Button type="button" variant="outline" onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError(''); }}>Cancel</Button>
 <Button type="submit" variant="destructive" form="delete-organization-form" disabled={deleteOrgMutation.isPending || !deletePassword}>{deleteOrgMutation.isPending ? 'Deleting...' : 'Delete Organization'}</Button>
 </ModalFooter>
 )}
 </Modal>
 </div>
 </Layout>
 );
}

export default OrganizationSettingsPage;
