// GeneralTab - Theme, palette, timezone, test defaults, artifact retention
// Feature #451: Extracted from SettingsPage.tsx

import { useState } from 'react';
import { useThemeStore, Theme } from '../../stores/themeStore';
import { usePaletteStore, PALETTE_OPTIONS } from '../../stores/paletteStore';
import { useTestDefaultsStore } from '../../stores/testDefaultsStore';
import { useArtifactRetentionStore } from '../../stores/artifactRetentionStore';
import { useOrganizationBrandingStore } from '../../stores/organizationBrandingStore';
import { toast } from '../../stores/toastStore';

export function GeneralTab() {
  const { theme, setTheme } = useThemeStore();
  const { palette, setPalette } = usePaletteStore();
  const { defaults, setAllDefaults } = useTestDefaultsStore();
  const { settings, setRetentionDays } = useArtifactRetentionStore();
  // Feature #1995: Organization branding for PDF exports
  const { logoBase64, organizationName, setLogo, setOrganizationName } = useOrganizationBrandingStore();

  const [orgName, setOrgName] = useState(organizationName || 'Default Organization');
  const [isSaving, setIsSaving] = useState(false);

  // Feature #1995: Handle logo upload
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
      if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
      if (!allowedTypes.includes(file.type)) { toast.error('Please use PNG, JPG, GIF, or WebP'); return; }
      if (file.size > 2 * 1024 * 1024) { toast.error('File too large. Maximum allowed size is 2MB.'); return; }

      // Convert to base64 for persistence and PDF embedding
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setLogo(base64);
        toast.success('Logo uploaded successfully! It will appear in PDF exports.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogo(null);
    toast.success('Logo removed');
  };

  const handleSaveOrgSettings = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    // Feature #1995: Save organization name to branding store
    setOrganizationName(orgName);
    toast.success('Organization settings saved');
    setIsSaving(false);
  };

  return (
    <div className="space-y-8">
      {/* Organization Settings */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Organization Settings</h3>
          <p className="text-sm text-muted-foreground">General settings for your organization.</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Organization Name</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-border rounded-md bg-background text-foreground"
            />
          </div>

          {/* Feature #1995: Organization Logo Upload for PDF Branding */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Organization Logo</label>
            <p className="text-xs text-muted-foreground mb-2">This logo will appear in PDF report exports.</p>
            <div className="flex items-center gap-4">
              {logoBase64 ? (
                <div className="relative">
                  <img src={logoBase64} alt="Organization logo" className="h-16 w-16 rounded-lg object-cover border border-border" />
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-white hover:bg-destructive/90"
                    aria-label="Remove logo"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              <div>
                <label htmlFor="logo-upload" className="cursor-pointer rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  {logoBase64 ? 'Change Logo' : 'Upload Logo'}
                </label>
                <input id="logo-upload" type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, GIF up to 2MB</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveOrgSettings}
            disabled={isSaving}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Theme Settings */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Appearance</h3>
          <p className="text-sm text-muted-foreground">Customize how QA Guardian looks.</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-6 space-y-6">
          {/* Light/Dark Mode Toggle */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Color Mode</label>
            <div className="flex gap-4">
              {(['light', 'dark', 'system'] as Theme[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                    theme === t
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl mb-2">
                      {t === 'light' ? '☀️' : t === 'dark' ? '🌙' : '💻'}
                    </div>
                    <div className="text-sm font-medium capitalize text-foreground">{t}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Feature #396: Color Palette Picker */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Accent Color</label>
            <p className="text-xs text-muted-foreground mb-3">Choose a color palette for buttons, links, and highlights.</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {PALETTE_OPTIONS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPalette(p.id)}
                  title={p.description}
                  className={`group relative p-3 rounded-lg border-2 transition-all ${
                    palette === p.id
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-full border-2 border-background shadow-sm"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-xs font-medium text-foreground truncate max-w-full">
                      {p.name.split(' ')[0]}
                    </span>
                  </div>
                  {palette === p.id && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Test Defaults */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Test Defaults</h3>
          <p className="text-sm text-muted-foreground">Default settings for new tests.</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Default Browser</label>
              <select
                value={defaults.defaultBrowser}
                onChange={(e) => setAllDefaults({ defaultBrowser: e.target.value as 'chromium' | 'firefox' | 'webkit' })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              >
                <option value="chromium">Chromium</option>
                <option value="firefox">Firefox</option>
                <option value="webkit">WebKit</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Default Timeout (ms)</label>
              <input
                type="number"
                value={defaults.defaultTimeout}
                onChange={(e) => setAllDefaults({ defaultTimeout: parseInt(e.target.value) || 30000 })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Default Retries</label>
            <input
              type="number"
              value={defaults.defaultRetries}
              onChange={(e) => setAllDefaults({ defaultRetries: parseInt(e.target.value) || 0 })}
              min={0}
              max={5}
              className="w-full max-w-xs px-3 py-2 border border-border rounded-md bg-background text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">Number of times to retry failed tests.</p>
          </div>
        </div>
      </div>

      {/* Artifact Retention */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Data Retention</h3>
          <p className="text-sm text-muted-foreground">How long to keep test artifacts.</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="max-w-md">
            <label className="block text-sm font-medium text-foreground mb-1">Artifact Retention (days)</label>
            <input
              type="number"
              value={settings.retentionDays}
              onChange={(e) => setRetentionDays(parseInt(e.target.value) || 30)}
              min={1}
              max={365}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Screenshots, videos, and traces will be automatically deleted after this period.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
