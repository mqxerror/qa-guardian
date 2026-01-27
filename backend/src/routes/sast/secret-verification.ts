/**
 * Secret Verification Module
 *
 * Feature #1565: Implement real secret verification
 *
 * Verifies if detected secrets are still active by testing against real services.
 * This helps prioritize remediation by identifying which exposed secrets are
 * actually exploitable.
 *
 * IMPORTANT: These verification calls are made carefully to avoid triggering
 * account lockouts or rate limiting. We use read-only API calls where possible.
 */

import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth';

// ============================================================
// Types
// ============================================================

export type VerificationStatus = 'active' | 'inactive' | 'unknown' | 'error';

export interface VerificationResult {
  status: VerificationStatus;
  verifiedAt: string;
  message: string;
  details?: {
    service?: string;
    accountInfo?: string;
    scopes?: string[];
    expiresAt?: string;
  };
}

export interface SecretVerificationRequest {
  secretType: string;
  secretValue: string;
  findingId?: string;
}

// ============================================================
// Service Verifiers
// ============================================================

/**
 * Verify AWS Access Key by calling STS GetCallerIdentity
 * This is a safe read-only call that doesn't modify anything
 */
async function verifyAwsKey(accessKeyId: string, secretAccessKey: string): Promise<VerificationResult> {
  try {
    // AWS STS GetCallerIdentity endpoint - read-only, no side effects
    const region = 'us-east-1';
    const service = 'sts';
    const host = `${service}.amazonaws.com`;
    const endpoint = `https://${host}/`;

    // Create the request timestamp
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    // For simplicity, we'll use a library approach via AWS SDK simulation
    // In production, you'd use the actual AWS SDK
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Host': host,
        'X-Amz-Date': amzDate,
        // AWS Signature V4 would be needed here - simplified for demo
        // In real implementation, use @aws-sdk/client-sts
      },
      body: 'Action=GetCallerIdentity&Version=2011-06-15',
    });

    if (response.status === 200) {
      return {
        status: 'active',
        verifiedAt: new Date().toISOString(),
        message: 'AWS credentials are active and valid',
        details: {
          service: 'AWS',
        },
      };
    } else if (response.status === 403) {
      return {
        status: 'inactive',
        verifiedAt: new Date().toISOString(),
        message: 'AWS credentials are invalid or expired',
      };
    } else {
      return {
        status: 'unknown',
        verifiedAt: new Date().toISOString(),
        message: `Unexpected response from AWS: ${response.status}`,
      };
    }
  } catch (error) {
    return {
      status: 'error',
      verifiedAt: new Date().toISOString(),
      message: `Error verifying AWS credentials: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Verify GitHub token by calling /user endpoint
 * This is a safe read-only call that shows token validity and scopes
 */
async function verifyGitHubToken(token: string): Promise<VerificationResult> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'QA-Guardian-Secret-Verification',
      },
    });

    if (response.status === 200) {
      const data = await response.json() as { login?: string };
      const scopes = response.headers.get('x-oauth-scopes')?.split(', ') || [];

      return {
        status: 'active',
        verifiedAt: new Date().toISOString(),
        message: 'GitHub token is active and valid',
        details: {
          service: 'GitHub',
          accountInfo: data.login ? `User: ${data.login}` : undefined,
          scopes: scopes.length > 0 ? scopes : undefined,
        },
      };
    } else if (response.status === 401) {
      return {
        status: 'inactive',
        verifiedAt: new Date().toISOString(),
        message: 'GitHub token is invalid, expired, or revoked',
      };
    } else if (response.status === 403) {
      // Could be rate limited or forbidden
      const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
      if (rateLimitRemaining === '0') {
        return {
          status: 'unknown',
          verifiedAt: new Date().toISOString(),
          message: 'GitHub API rate limit exceeded, could not verify',
        };
      }
      return {
        status: 'active',
        verifiedAt: new Date().toISOString(),
        message: 'GitHub token is valid but lacks permissions for /user endpoint',
      };
    } else {
      return {
        status: 'unknown',
        verifiedAt: new Date().toISOString(),
        message: `Unexpected response from GitHub: ${response.status}`,
      };
    }
  } catch (error) {
    return {
      status: 'error',
      verifiedAt: new Date().toISOString(),
      message: `Error verifying GitHub token: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Verify Slack token by calling auth.test endpoint
 * This is a safe read-only call that shows token validity
 */
async function verifySlackToken(token: string): Promise<VerificationResult> {
  try {
    const response = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = await response.json() as {
      ok: boolean;
      error?: string;
      user?: string;
      team?: string;
    };

    if (data.ok) {
      return {
        status: 'active',
        verifiedAt: new Date().toISOString(),
        message: 'Slack token is active and valid',
        details: {
          service: 'Slack',
          accountInfo: data.team ? `Team: ${data.team}${data.user ? `, User: ${data.user}` : ''}` : undefined,
        },
      };
    } else if (data.error === 'invalid_auth' || data.error === 'token_revoked') {
      return {
        status: 'inactive',
        verifiedAt: new Date().toISOString(),
        message: `Slack token is invalid: ${data.error}`,
      };
    } else {
      return {
        status: 'unknown',
        verifiedAt: new Date().toISOString(),
        message: `Slack API error: ${data.error || 'Unknown error'}`,
      };
    }
  } catch (error) {
    return {
      status: 'error',
      verifiedAt: new Date().toISOString(),
      message: `Error verifying Slack token: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Verify Stripe API key by calling /v1/account endpoint
 */
async function verifyStripeKey(apiKey: string): Promise<VerificationResult> {
  try {
    const response = await fetch('https://api.stripe.com/v1/account', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.status === 200) {
      const data = await response.json() as { id?: string; business_profile?: { name?: string } };
      return {
        status: 'active',
        verifiedAt: new Date().toISOString(),
        message: 'Stripe API key is active and valid',
        details: {
          service: 'Stripe',
          accountInfo: data.business_profile?.name || data.id,
        },
      };
    } else if (response.status === 401) {
      return {
        status: 'inactive',
        verifiedAt: new Date().toISOString(),
        message: 'Stripe API key is invalid',
      };
    } else {
      return {
        status: 'unknown',
        verifiedAt: new Date().toISOString(),
        message: `Unexpected response from Stripe: ${response.status}`,
      };
    }
  } catch (error) {
    return {
      status: 'error',
      verifiedAt: new Date().toISOString(),
      message: `Error verifying Stripe key: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Verify SendGrid API key by calling /v3/user/email endpoint
 */
async function verifySendGridKey(apiKey: string): Promise<VerificationResult> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/user/email', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.status === 200) {
      const data = await response.json() as { email?: string };
      return {
        status: 'active',
        verifiedAt: new Date().toISOString(),
        message: 'SendGrid API key is active and valid',
        details: {
          service: 'SendGrid',
          accountInfo: data.email,
        },
      };
    } else if (response.status === 401 || response.status === 403) {
      return {
        status: 'inactive',
        verifiedAt: new Date().toISOString(),
        message: 'SendGrid API key is invalid or revoked',
      };
    } else {
      return {
        status: 'unknown',
        verifiedAt: new Date().toISOString(),
        message: `Unexpected response from SendGrid: ${response.status}`,
      };
    }
  } catch (error) {
    return {
      status: 'error',
      verifiedAt: new Date().toISOString(),
      message: `Error verifying SendGrid key: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Verify Twilio credentials by calling /Accounts endpoint
 */
async function verifyTwilioCredentials(accountSid: string, authToken: string): Promise<VerificationResult> {
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
    });

    if (response.status === 200) {
      const data = await response.json() as { friendly_name?: string; status?: string };
      return {
        status: 'active',
        verifiedAt: new Date().toISOString(),
        message: 'Twilio credentials are active and valid',
        details: {
          service: 'Twilio',
          accountInfo: data.friendly_name || accountSid,
        },
      };
    } else if (response.status === 401) {
      return {
        status: 'inactive',
        verifiedAt: new Date().toISOString(),
        message: 'Twilio credentials are invalid',
      };
    } else {
      return {
        status: 'unknown',
        verifiedAt: new Date().toISOString(),
        message: `Unexpected response from Twilio: ${response.status}`,
      };
    }
  } catch (error) {
    return {
      status: 'error',
      verifiedAt: new Date().toISOString(),
      message: `Error verifying Twilio credentials: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Verify Mailchimp API key by calling /ping endpoint
 */
async function verifyMailchimpKey(apiKey: string): Promise<VerificationResult> {
  try {
    // Mailchimp API keys end with -usX where X is the datacenter number
    const dcMatch = apiKey.match(/-us(\d+)$/);
    if (!dcMatch) {
      return {
        status: 'unknown',
        verifiedAt: new Date().toISOString(),
        message: 'Invalid Mailchimp API key format (missing datacenter suffix)',
      };
    }
    const dc = `us${dcMatch[1]}`;

    const response = await fetch(`https://${dc}.api.mailchimp.com/3.0/ping`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.status === 200) {
      return {
        status: 'active',
        verifiedAt: new Date().toISOString(),
        message: 'Mailchimp API key is active and valid',
        details: {
          service: 'Mailchimp',
        },
      };
    } else if (response.status === 401) {
      return {
        status: 'inactive',
        verifiedAt: new Date().toISOString(),
        message: 'Mailchimp API key is invalid or revoked',
      };
    } else {
      return {
        status: 'unknown',
        verifiedAt: new Date().toISOString(),
        message: `Unexpected response from Mailchimp: ${response.status}`,
      };
    }
  } catch (error) {
    return {
      status: 'error',
      verifiedAt: new Date().toISOString(),
      message: `Error verifying Mailchimp key: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// ============================================================
// Main Verification Function
// ============================================================

/**
 * Verify a secret based on its type
 * Returns verification result indicating if the secret is still active
 */
export async function verifySecret(secretType: string, secretValue: string): Promise<VerificationResult> {
  const normalizedType = secretType.toLowerCase().replace(/[_-]/g, '');

  // GitHub tokens
  if (normalizedType.includes('github') || secretValue.startsWith('ghp_') || secretValue.startsWith('gho_') || secretValue.startsWith('ghs_') || secretValue.startsWith('ghr_')) {
    return verifyGitHubToken(secretValue);
  }

  // Slack tokens
  if (normalizedType.includes('slack') || secretValue.startsWith('xoxb-') || secretValue.startsWith('xoxp-') || secretValue.startsWith('xoxa-') || secretValue.startsWith('xoxs-')) {
    return verifySlackToken(secretValue);
  }

  // Stripe API keys
  if (normalizedType.includes('stripe') || secretValue.startsWith('sk_live_') || secretValue.startsWith('sk_test_') || secretValue.startsWith('rk_live_') || secretValue.startsWith('rk_test_')) {
    return verifyStripeKey(secretValue);
  }

  // SendGrid API keys
  if (normalizedType.includes('sendgrid') || secretValue.startsWith('SG.')) {
    return verifySendGridKey(secretValue);
  }

  // Mailchimp API keys
  if (normalizedType.includes('mailchimp') || /^[a-f0-9]{32}-us\d+$/.test(secretValue)) {
    return verifyMailchimpKey(secretValue);
  }

  // AWS keys - need both access key and secret key
  // For now, return unknown as we need both values
  if (normalizedType.includes('aws') || secretValue.startsWith('AKIA') || secretValue.startsWith('ABIA') || secretValue.startsWith('ACCA')) {
    return {
      status: 'unknown',
      verifiedAt: new Date().toISOString(),
      message: 'AWS key verification requires both access key ID and secret access key',
    };
  }

  // Twilio - need both SID and auth token
  if (normalizedType.includes('twilio') || secretValue.startsWith('AC')) {
    return {
      status: 'unknown',
      verifiedAt: new Date().toISOString(),
      message: 'Twilio verification requires both Account SID and Auth Token',
    };
  }

  // Default case - cannot verify
  return {
    status: 'unknown',
    verifiedAt: new Date().toISOString(),
    message: `Verification not supported for secret type: ${secretType}`,
  };
}

// ============================================================
// Routes
// ============================================================

export async function secretVerificationRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/sast/secrets/verify
   * Verify if a detected secret is still active
   */
  app.post<{
    Body: SecretVerificationRequest;
  }>(
    '/api/v1/sast/secrets/verify',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { secretType, secretValue, findingId } = request.body;

      if (!secretType || !secretValue) {
        return reply.status(400).send({
          error: 'Missing required fields: secretType and secretValue',
        });
      }

      // Verify the secret
      const result = await verifySecret(secretType, secretValue);

      return reply.send({
        success: true,
        findingId,
        verification: result,
      });
    }
  );

  /**
   * GET /api/v1/sast/secrets/supported-verifications
   * List which secret types support verification
   */
  app.get(
    '/api/v1/sast/secrets/supported-verifications',
    { preHandler: [authenticate] },
    async (_request, reply) => {
      return reply.send({
        supportedTypes: [
          {
            type: 'github',
            description: 'GitHub Personal Access Tokens (ghp_, gho_, ghs_, ghr_ prefixes)',
            verificationMethod: 'GET /user API call',
          },
          {
            type: 'slack',
            description: 'Slack Bot and User Tokens (xoxb-, xoxp-, xoxa-, xoxs- prefixes)',
            verificationMethod: 'auth.test API call',
          },
          {
            type: 'stripe',
            description: 'Stripe API Keys (sk_live_, sk_test_, rk_live_, rk_test_ prefixes)',
            verificationMethod: 'GET /v1/account API call',
          },
          {
            type: 'sendgrid',
            description: 'SendGrid API Keys (SG. prefix)',
            verificationMethod: 'GET /v3/user/email API call',
          },
          {
            type: 'mailchimp',
            description: 'Mailchimp API Keys (32 hex chars + datacenter suffix)',
            verificationMethod: 'GET /3.0/ping API call',
          },
        ],
        partialSupport: [
          {
            type: 'aws',
            description: 'AWS Access Keys (AKIA, ABIA, ACCA prefixes)',
            requirement: 'Requires both Access Key ID and Secret Access Key for verification',
          },
          {
            type: 'twilio',
            description: 'Twilio Credentials (AC prefix for SID)',
            requirement: 'Requires both Account SID and Auth Token for verification',
          },
        ],
      });
    }
  );
}
