const Database = require('better-sqlite3');
const db = new Database('./features.db');
const now = new Date().toISOString();
const evidence = `Fixed 15 create-test config files with dark mode token replacements:
- LoadConfig.tsx (9 occurrences)
- PerformanceConfig.tsx (7 occurrences)
- AccessibilityConfig.tsx (6 occurrences)
- E2EConfig.tsx (6 occurrences)
- VisualConfig.tsx (5 occurrences)
- ManualSetupStep.tsx (12 occurrences)
- AIGenerateStep.tsx (8 occurrences)
- CreateTestModal.tsx (2 occurrences)
- CustomTestWizard.tsx (1 occurrence)
- ReviewStep.tsx (1 occurrence)
- TestTypeCards.tsx (1 occurrence)
- URLInput.tsx (2 occurrences)
- StepBuilder.tsx (6 occurrences)
- CustomViewportPanel.tsx (6 occurrences)
- AdvancedSettingsPanel.tsx (6 occurrences)

Token mappings: bg-white dark:bg-gray-800 -> bg-card, bg-white dark:bg-gray-700 -> bg-input, text-gray-900 dark:text-white -> text-foreground

Build: 0 errors, Lint: 0 errors
Commit: f87ca4f`;

db.prepare(`UPDATE features SET passes = 1, in_progress = 0, verification_evidence = ?, marked_passing_at = ? WHERE id = 379`).run(evidence, now);
console.log('Feature #379 marked as passing');
db.close();
