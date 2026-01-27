# Documentation Instructions for AI Agent

## When Completing Features

After implementing and marking a feature as complete (`feature_mark_passing`), you MUST also add documentation and capture a screenshot:

### Step 0: Capture Screenshot (If UI Feature)

For features with visible UI, capture a screenshot:
```bash
python3 scripts/capture-feature-screenshot.py <feature_id> <url> [css_selector]
```

Examples:
```bash
# Full page screenshot
python3 scripts/capture-feature-screenshot.py 42 http://localhost:3000/dashboard

# Specific element screenshot
python3 scripts/capture-feature-screenshot.py 42 http://localhost:3000/dashboard ".main-panel"
```

Screenshots are saved to `docs/images/features/` and automatically linked in docs.

### Step 1: Update the feature with documentation

```sql
UPDATE features
SET user_docs = 'User-friendly description of how to use this feature.',
    api_docs = 'API endpoint or MCP tool info (if applicable)',
    dev_notes = 'Implementation notes for developers (optional)'
WHERE id = <feature_id>;
```

### Step 2: Regenerate documentation

Run this command after adding docs:
```bash
python3 scripts/generate-docs.py
```

Or run the auto-docs script which handles both:
```bash
python3 scripts/auto-docs.py
```

## Documentation Quality Guidelines

### user_docs (Required)
- Write for end users, not developers
- Explain WHAT they can do, not HOW it works
- Use simple, clear language
- Examples:
  - ✅ "Click the Run button to execute your test."
  - ❌ "Invokes the Playwright runner with configured options."

### api_docs (For API/MCP features)
- Include endpoint: `POST /api/v1/tests/{id}/run`
- Include MCP tool: `Tool: trigger-test-run { suiteId: string }`
- Document parameters and return values

### dev_notes (Optional)
- Implementation details
- File locations
- Dependencies
- Performance considerations

## Checking Documentation Status

The user may ask "check docs status" - run:
```bash
python3 scripts/check-docs.py
```

This shows:
- Total features completed
- Documentation coverage percentage
- Features missing documentation
- Health score (🟢🟡🟠🔴)

## Auto-Documentation

If you forget to add docs, running `auto-docs.py` will:
1. Generate basic docs from feature name/description
2. Regenerate all documentation files
3. Report documentation health

However, AI-written docs are always better than auto-generated ones!
