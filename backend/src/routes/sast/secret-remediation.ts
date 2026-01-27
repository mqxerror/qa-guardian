/**
 * Secret Remediation Module
 *
 * Feature #1566: Add secret remediation suggestions
 *
 * Provides specific guidance on how to rotate or revoke each type of detected secret.
 * Includes links to relevant documentation, console URLs, and step-by-step instructions.
 */

import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth';

// ============================================================
// Types
// ============================================================

export interface RemediationStep {
  order: number;
  title: string;
  description: string;
  command?: string;  // CLI command if applicable
  url?: string;      // Link to relevant page/documentation
}

export interface RemediationGuide {
  secretType: string;
  displayName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  summary: string;
  immediateActions: string[];
  rotationSteps: RemediationStep[];
  gitCleanupSteps: RemediationStep[];
  preventionTips: string[];
  documentationLinks: {
    title: string;
    url: string;
  }[];
  environmentVariableExample?: string;
}

// ============================================================
// Remediation Guides Database
// ============================================================

const REMEDIATION_GUIDES: Record<string, RemediationGuide> = {
  // AWS Credentials
  'aws-access-key': {
    secretType: 'aws-access-key',
    displayName: 'AWS Access Key',
    severity: 'critical',
    summary: 'AWS access keys provide programmatic access to your AWS account. Exposed keys can be used to access, modify, or delete any resources the key has permissions for.',
    immediateActions: [
      'Disable the exposed key immediately in AWS IAM Console',
      'Check CloudTrail logs for any unauthorized activity',
      'Review and update IAM policies to follow least-privilege principle',
    ],
    rotationSteps: [
      {
        order: 1,
        title: 'Go to AWS IAM Console',
        description: 'Navigate to the IAM console and select the affected user',
        url: 'https://console.aws.amazon.com/iam/home#/users',
      },
      {
        order: 2,
        title: 'Deactivate the compromised key',
        description: 'Find the access key under "Security credentials" tab and set it to Inactive',
        command: 'aws iam update-access-key --access-key-id AKIA... --status Inactive --user-name USERNAME',
      },
      {
        order: 3,
        title: 'Create a new access key',
        description: 'Generate a new access key pair for the user',
        command: 'aws iam create-access-key --user-name USERNAME',
      },
      {
        order: 4,
        title: 'Update applications',
        description: 'Replace the old credentials in all applications and services',
      },
      {
        order: 5,
        title: 'Delete the old key',
        description: 'Once all applications are updated, permanently delete the compromised key',
        command: 'aws iam delete-access-key --access-key-id AKIA... --user-name USERNAME',
      },
    ],
    gitCleanupSteps: [
      {
        order: 1,
        title: 'Remove from repository',
        description: 'Delete the file or line containing the secret and commit the change',
      },
      {
        order: 2,
        title: 'Rewrite git history',
        description: 'Use BFG Repo-Cleaner or git-filter-repo to remove the secret from history',
        command: 'bfg --replace-text passwords.txt --no-blob-protection',
      },
      {
        order: 3,
        title: 'Force push changes',
        description: 'Push the cleaned history (requires coordination with team)',
        command: 'git push --force-with-lease',
      },
      {
        order: 4,
        title: 'Expire reflog',
        description: 'Remove old references to ensure garbage collection',
        command: 'git reflog expire --expire=now --all && git gc --prune=now',
      },
    ],
    preventionTips: [
      'Use AWS IAM roles instead of access keys when possible',
      'Use AWS Secrets Manager or Parameter Store for credentials',
      'Enable MFA on all IAM users with programmatic access',
      'Set up AWS Config rules to detect long-lived access keys',
      'Use pre-commit hooks to scan for secrets before committing',
    ],
    documentationLinks: [
      { title: 'AWS IAM Best Practices', url: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html' },
      { title: 'Managing Access Keys', url: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html' },
      { title: 'AWS Secrets Manager', url: 'https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html' },
    ],
    environmentVariableExample: 'export AWS_ACCESS_KEY_ID="$(aws secretsmanager get-secret-value --secret-id my-secret --query SecretString --output text | jq -r .AWS_ACCESS_KEY_ID)"',
  },

  // GitHub Token
  'github-token': {
    secretType: 'github-token',
    displayName: 'GitHub Personal Access Token',
    severity: 'high',
    summary: 'GitHub tokens provide API access to your repositories and account. Exposed tokens can be used to access private repos, modify code, or impersonate you.',
    immediateActions: [
      'Revoke the token immediately in GitHub settings',
      'Review recent activity in your GitHub audit log',
      'Check for any unauthorized commits or changes',
    ],
    rotationSteps: [
      {
        order: 1,
        title: 'Go to GitHub Token Settings',
        description: 'Navigate to your GitHub account token settings',
        url: 'https://github.com/settings/tokens',
      },
      {
        order: 2,
        title: 'Revoke the compromised token',
        description: 'Find the exposed token and click "Delete" to immediately revoke it',
      },
      {
        order: 3,
        title: 'Create a new token',
        description: 'Generate a new token with only the minimum required scopes',
        url: 'https://github.com/settings/tokens/new',
      },
      {
        order: 4,
        title: 'Update applications',
        description: 'Replace the old token in all applications, CI/CD pipelines, and scripts',
      },
    ],
    gitCleanupSteps: [
      {
        order: 1,
        title: 'Remove from repository',
        description: 'Delete the file or line containing the token',
      },
      {
        order: 2,
        title: 'Use git-filter-repo',
        description: 'Remove the token from entire git history',
        command: 'git filter-repo --replace-text replacements.txt',
      },
      {
        order: 3,
        title: 'Contact GitHub Support',
        description: 'For public repos, GitHub may have cached the secret - contact support@github.com',
      },
    ],
    preventionTips: [
      'Use GitHub Apps instead of personal access tokens for automation',
      'Set token expiration dates',
      'Use fine-grained tokens with minimal permissions',
      'Store tokens in environment variables or secrets managers',
      'Enable GitHub secret scanning alerts',
    ],
    documentationLinks: [
      { title: 'Managing Personal Access Tokens', url: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens' },
      { title: 'GitHub Secret Scanning', url: 'https://docs.github.com/en/code-security/secret-scanning' },
      { title: 'Fine-grained Tokens', url: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token#fine-grained-personal-access-tokens' },
    ],
    environmentVariableExample: 'export GITHUB_TOKEN="$(gh auth token)"',
  },

  // Slack Token
  'slack-token': {
    secretType: 'slack-token',
    displayName: 'Slack API Token',
    severity: 'high',
    summary: 'Slack tokens provide access to your workspace. Exposed tokens can be used to read messages, send as your bot/user, or access sensitive workspace data.',
    immediateActions: [
      'Revoke the token in Slack App settings',
      'Review Slack access logs for unauthorized activity',
      'Notify your workspace administrator',
    ],
    rotationSteps: [
      {
        order: 1,
        title: 'Go to Slack App Management',
        description: 'Navigate to your Slack app settings',
        url: 'https://api.slack.com/apps',
      },
      {
        order: 2,
        title: 'Regenerate tokens',
        description: 'In OAuth & Permissions, reinstall the app to get new tokens',
      },
      {
        order: 3,
        title: 'Update applications',
        description: 'Replace the old token in all applications using this Slack integration',
      },
    ],
    gitCleanupSteps: [
      {
        order: 1,
        title: 'Remove from repository',
        description: 'Delete the file or line containing the token',
      },
      {
        order: 2,
        title: 'Rewrite history',
        description: 'Use BFG or git-filter-repo to remove from history',
        command: 'bfg --replace-text secrets.txt',
      },
    ],
    preventionTips: [
      'Use Slack app-level tokens with minimal scopes',
      'Store tokens in a secrets manager',
      'Use socket mode for development to avoid exposing webhooks',
      'Regularly rotate tokens',
    ],
    documentationLinks: [
      { title: 'Slack Token Types', url: 'https://api.slack.com/authentication/token-types' },
      { title: 'Slack App Security', url: 'https://api.slack.com/authentication/best-practices' },
    ],
    environmentVariableExample: 'export SLACK_BOT_TOKEN="$(vault kv get -field=token secret/slack)"',
  },

  // Stripe API Key
  'stripe-key': {
    secretType: 'stripe-key',
    displayName: 'Stripe API Key',
    severity: 'critical',
    summary: 'Stripe API keys provide access to payment processing. Exposed keys can be used to view customer data, process charges, or access sensitive financial information.',
    immediateActions: [
      'Roll the API key immediately in Stripe Dashboard',
      'Review recent API activity for unauthorized calls',
      'Check for unauthorized transactions or customer data access',
    ],
    rotationSteps: [
      {
        order: 1,
        title: 'Go to Stripe API Keys',
        description: 'Navigate to the Stripe Dashboard API keys page',
        url: 'https://dashboard.stripe.com/apikeys',
      },
      {
        order: 2,
        title: 'Roll the compromised key',
        description: 'Click "Roll key" next to the exposed key - this creates a new key and gives you 24h to update',
      },
      {
        order: 3,
        title: 'Update applications',
        description: 'Replace the old key in all applications within the grace period',
      },
      {
        order: 4,
        title: 'Confirm the roll',
        description: 'After updating all apps, confirm the roll to permanently revoke the old key',
      },
    ],
    gitCleanupSteps: [
      {
        order: 1,
        title: 'Remove from repository',
        description: 'Delete the file or line containing the key',
      },
      {
        order: 2,
        title: 'Rewrite history',
        description: 'Use git-filter-repo to remove from all commits',
        command: 'git filter-repo --replace-text stripe-keys.txt',
      },
    ],
    preventionTips: [
      'Use restricted keys with minimal permissions',
      'Use separate keys for development/production',
      'Enable Stripe Radar for fraud detection',
      'Set up webhook signature verification',
      'Use Stripe CLI for local development',
    ],
    documentationLinks: [
      { title: 'Stripe API Keys', url: 'https://stripe.com/docs/keys' },
      { title: 'Stripe Security Best Practices', url: 'https://stripe.com/docs/security/guide' },
      { title: 'Restricted API Keys', url: 'https://stripe.com/docs/keys#limit-access' },
    ],
    environmentVariableExample: 'export STRIPE_SECRET_KEY="$(aws secretsmanager get-secret-value --secret-id stripe-key --query SecretString --output text)"',
  },

  // SendGrid API Key
  'sendgrid-key': {
    secretType: 'sendgrid-key',
    displayName: 'SendGrid API Key',
    severity: 'high',
    summary: 'SendGrid API keys provide access to email services. Exposed keys can be used to send spam, access customer contacts, or view email analytics.',
    immediateActions: [
      'Delete the API key in SendGrid settings',
      'Review email activity for unauthorized sends',
      'Check for suspicious sender identities created',
    ],
    rotationSteps: [
      {
        order: 1,
        title: 'Go to SendGrid API Keys',
        description: 'Navigate to SendGrid API key settings',
        url: 'https://app.sendgrid.com/settings/api_keys',
      },
      {
        order: 2,
        title: 'Delete the compromised key',
        description: 'Find the exposed key and delete it immediately',
      },
      {
        order: 3,
        title: 'Create a new key',
        description: 'Generate a new API key with only required permissions',
      },
      {
        order: 4,
        title: 'Update applications',
        description: 'Replace the old key in all email-sending applications',
      },
    ],
    gitCleanupSteps: [
      {
        order: 1,
        title: 'Remove from repository',
        description: 'Delete the file or line containing the key',
      },
      {
        order: 2,
        title: 'Rewrite history',
        description: 'Use BFG to remove from git history',
        command: 'bfg --replace-text sendgrid-keys.txt',
      },
    ],
    preventionTips: [
      'Use restricted access keys with minimal scopes',
      'Enable IP access management',
      'Use subusers for different applications',
      'Monitor sending activity regularly',
    ],
    documentationLinks: [
      { title: 'SendGrid API Keys', url: 'https://docs.sendgrid.com/ui/account-and-settings/api-keys' },
      { title: 'SendGrid Security', url: 'https://docs.sendgrid.com/for-developers/sending-email/security-checklist' },
    ],
    environmentVariableExample: 'export SENDGRID_API_KEY="$(vault read -field=api_key secret/sendgrid)"',
  },

  // Database Connection String
  'database-connection': {
    secretType: 'database-connection',
    displayName: 'Database Connection String',
    severity: 'critical',
    summary: 'Database credentials provide direct access to your data. Exposed credentials can lead to data theft, modification, or complete database destruction.',
    immediateActions: [
      'Change the database password immediately',
      'Review database logs for unauthorized access',
      'Check for any data exfiltration or modifications',
    ],
    rotationSteps: [
      {
        order: 1,
        title: 'Assess the impact',
        description: 'Determine which databases and data may have been accessed',
      },
      {
        order: 2,
        title: 'Change database credentials',
        description: 'Update the password for the affected user account',
        command: "ALTER USER 'username'@'host' IDENTIFIED BY 'new_secure_password';",
      },
      {
        order: 3,
        title: 'Update applications',
        description: 'Update all applications with the new credentials',
      },
      {
        order: 4,
        title: 'Review access controls',
        description: 'Ensure database users have minimum required privileges',
      },
    ],
    gitCleanupSteps: [
      {
        order: 1,
        title: 'Remove from repository',
        description: 'Delete connection strings from code',
      },
      {
        order: 2,
        title: 'Rewrite history',
        description: 'Remove credentials from git history completely',
        command: 'git filter-repo --replace-text db-creds.txt',
      },
    ],
    preventionTips: [
      'Use IAM database authentication where available',
      'Store credentials in secrets managers (AWS Secrets Manager, Vault, etc.)',
      'Use connection poolers that handle credential rotation',
      'Enable database audit logging',
      'Use network security groups to restrict database access',
    ],
    documentationLinks: [
      { title: 'AWS RDS IAM Authentication', url: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.html' },
      { title: 'Azure SQL Managed Identity', url: 'https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/tutorial-windows-vm-access-sql' },
    ],
    environmentVariableExample: 'export DATABASE_URL="$(vault kv get -field=url secret/database)"',
  },

  // Private Key
  'private-key': {
    secretType: 'private-key',
    displayName: 'Private Key (RSA/EC/SSH)',
    severity: 'critical',
    summary: 'Private keys are used for authentication and encryption. Exposed keys can be used to impersonate servers, decrypt data, or gain unauthorized access.',
    immediateActions: [
      'Revoke and regenerate the key pair immediately',
      'Update all systems using the key',
      'Check for unauthorized access using the key',
    ],
    rotationSteps: [
      {
        order: 1,
        title: 'Generate new key pair',
        description: 'Create a new private/public key pair',
        command: 'ssh-keygen -t ed25519 -C "your_email@example.com"',
      },
      {
        order: 2,
        title: 'Deploy new public key',
        description: 'Add the new public key to all authorized_keys files and services',
      },
      {
        order: 3,
        title: 'Remove old public key',
        description: 'Remove the compromised public key from all services',
      },
      {
        order: 4,
        title: 'Delete old private key',
        description: 'Securely delete the compromised private key file',
        command: 'shred -u ~/.ssh/compromised_key',
      },
    ],
    gitCleanupSteps: [
      {
        order: 1,
        title: 'Remove from repository',
        description: 'Delete the private key file from the repository',
      },
      {
        order: 2,
        title: 'Rewrite history completely',
        description: 'Private keys must be removed from all history',
        command: 'git filter-repo --path path/to/key --invert-paths',
      },
      {
        order: 3,
        title: 'Force push and notify',
        description: 'Force push and notify all contributors to re-clone',
      },
    ],
    preventionTips: [
      'Never commit private keys to repositories',
      'Use SSH agent forwarding instead of copying keys',
      'Use hardware security modules (HSM) for critical keys',
      'Set up certificate-based authentication with short-lived certs',
      'Use Git hooks to prevent key commits',
    ],
    documentationLinks: [
      { title: 'GitHub SSH Keys', url: 'https://docs.github.com/en/authentication/connecting-to-github-with-ssh' },
      { title: 'SSH Best Practices', url: 'https://www.ssh.com/academy/ssh/keygen' },
    ],
    environmentVariableExample: 'export SSH_PRIVATE_KEY="$(vault read -field=private_key secret/ssh)"',
  },

  // Generic/Default
  'generic-secret': {
    secretType: 'generic-secret',
    displayName: 'Generic Secret/API Key',
    severity: 'medium',
    summary: 'Exposed secrets can provide unauthorized access to services. The impact depends on the specific service and permissions associated with the secret.',
    immediateActions: [
      'Identify what service the secret is for',
      'Revoke or rotate the secret in that service',
      'Review logs for unauthorized access',
    ],
    rotationSteps: [
      {
        order: 1,
        title: 'Identify the service',
        description: 'Determine which service or API this secret belongs to',
      },
      {
        order: 2,
        title: 'Revoke in service console',
        description: 'Go to the service settings and revoke/regenerate the credential',
      },
      {
        order: 3,
        title: 'Update applications',
        description: 'Update all applications using this credential',
      },
    ],
    gitCleanupSteps: [
      {
        order: 1,
        title: 'Remove from repository',
        description: 'Delete the secret from the codebase',
      },
      {
        order: 2,
        title: 'Rewrite history',
        description: 'Remove the secret from git history',
        command: 'git filter-repo --replace-text secrets.txt',
      },
    ],
    preventionTips: [
      'Use a secrets manager for all credentials',
      'Set up pre-commit hooks to scan for secrets',
      'Use environment variables for configuration',
      'Follow the principle of least privilege',
    ],
    documentationLinks: [
      { title: 'Git Secrets Prevention', url: 'https://github.com/awslabs/git-secrets' },
      { title: 'BFG Repo-Cleaner', url: 'https://rtyley.github.io/bfg-repo-cleaner/' },
    ],
    environmentVariableExample: 'export API_SECRET="$(secretsmanager get-secret --name my-secret)"',
  },
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * Get remediation guide for a secret type
 */
export function getRemediationGuide(secretType: string): RemediationGuide {
  const normalizedType = secretType.toLowerCase().replace(/[_-]/g, '');

  // AWS
  if (normalizedType.includes('aws') || normalizedType.includes('akia')) {
    return REMEDIATION_GUIDES['aws-access-key']!;
  }

  // GitHub
  if (normalizedType.includes('github') || normalizedType.includes('ghp') || normalizedType.includes('gho')) {
    return REMEDIATION_GUIDES['github-token']!;
  }

  // Slack
  if (normalizedType.includes('slack') || normalizedType.includes('xoxb') || normalizedType.includes('xoxp')) {
    return REMEDIATION_GUIDES['slack-token']!;
  }

  // Stripe
  if (normalizedType.includes('stripe') || normalizedType.includes('sklive') || normalizedType.includes('sktest')) {
    return REMEDIATION_GUIDES['stripe-key']!;
  }

  // SendGrid
  if (normalizedType.includes('sendgrid')) {
    return REMEDIATION_GUIDES['sendgrid-key']!;
  }

  // Database
  if (normalizedType.includes('database') || normalizedType.includes('postgres') || normalizedType.includes('mysql') || normalizedType.includes('mongodb') || normalizedType.includes('connection')) {
    return REMEDIATION_GUIDES['database-connection']!;
  }

  // Private Keys
  if (normalizedType.includes('privatekey') || normalizedType.includes('rsa') || normalizedType.includes('ssh')) {
    return REMEDIATION_GUIDES['private-key']!;
  }

  // Default to generic
  return REMEDIATION_GUIDES['generic-secret']!;
}

/**
 * Git history cleanup instructions (common to all secret types)
 */
export const GIT_HISTORY_CLEANUP_GUIDE = {
  title: 'Complete Git History Cleanup Guide',
  description: 'Steps to remove secrets from your entire git history',
  warning: 'This will rewrite git history. Coordinate with your team before performing these steps.',
  tools: [
    {
      name: 'BFG Repo-Cleaner',
      description: 'Fast, simple tool for cleaning git history',
      url: 'https://rtyley.github.io/bfg-repo-cleaner/',
      steps: [
        'Download BFG: https://rtyley.github.io/bfg-repo-cleaner/',
        'Create a fresh clone: git clone --mirror git@github.com:user/repo.git',
        'Create replacements.txt with secrets (one per line)',
        'Run: java -jar bfg.jar --replace-text replacements.txt repo.git',
        'cd repo.git && git reflog expire --expire=now --all && git gc --prune=now --aggressive',
        'git push --force',
      ],
    },
    {
      name: 'git-filter-repo',
      description: 'Modern, flexible alternative to git-filter-branch',
      url: 'https://github.com/newren/git-filter-repo',
      steps: [
        'Install: pip install git-filter-repo',
        'Create a fresh clone (no remote)',
        'Create replacements.txt: literal:SECRET==>REMOVED',
        'Run: git filter-repo --replace-text replacements.txt',
        'Add remote back: git remote add origin URL',
        'Force push: git push --force-with-lease',
      ],
    },
  ],
  postCleanup: [
    'Notify all team members to re-clone the repository',
    'Delete any forks that may contain the secret',
    'Clear CI/CD caches that may have cached the secret',
    'Request GitHub/GitLab support to clear server-side caches',
    'Update any pull request branches',
  ],
};

// ============================================================
// Routes
// ============================================================

export async function secretRemediationRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/sast/secrets/remediation/:secretType
   * Get remediation guide for a specific secret type
   */
  app.get<{
    Params: { secretType: string };
  }>(
    '/api/v1/sast/secrets/remediation/:secretType',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { secretType } = request.params;
      const guide = getRemediationGuide(secretType);

      return reply.send({
        success: true,
        guide,
      });
    }
  );

  /**
   * GET /api/v1/sast/secrets/remediation-types
   * List all available remediation guides
   */
  app.get(
    '/api/v1/sast/secrets/remediation-types',
    { preHandler: [authenticate] },
    async (_request, reply) => {
      const types = Object.values(REMEDIATION_GUIDES).map(guide => ({
        secretType: guide.secretType,
        displayName: guide.displayName,
        severity: guide.severity,
        summary: guide.summary,
      }));

      return reply.send({
        success: true,
        types,
      });
    }
  );

  /**
   * GET /api/v1/sast/secrets/git-cleanup-guide
   * Get the complete git history cleanup guide
   */
  app.get(
    '/api/v1/sast/secrets/git-cleanup-guide',
    { preHandler: [authenticate] },
    async (_request, reply) => {
      return reply.send({
        success: true,
        guide: GIT_HISTORY_CLEANUP_GUIDE,
      });
    }
  );
}
