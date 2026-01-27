/**
 * AI Test Generator Module - Type Definitions
 * Feature #1499: Add test generation history and versioning
 * Feature #1500: Implement approval workflow for generated tests
 */

// Approval status for generated tests
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

// Approval metadata
export interface ApprovalInfo {
  status: ApprovalStatus;
  reviewed_by?: string;
  reviewed_by_name?: string;
  reviewed_at?: Date;
  review_comment?: string;
  added_to_suite_id?: string;
  added_to_suite_name?: string;
}

// AI-generated test record stored in history
export interface AIGeneratedTest {
  id: string;
  user_id: string;
  organization_id?: string;
  project_id?: string;
  description: string;
  generated_code: string;
  test_name: string;
  language: 'typescript' | 'javascript';
  confidence_score: number;
  confidence_level: 'high' | 'medium' | 'low';
  version: number;
  parent_version_id?: string; // Reference to previous version for regenerations
  feedback?: string; // Feedback used for regeneration
  ai_metadata: {
    provider: string;
    model: string;
    used_real_ai: boolean;
    input_tokens?: number;
    output_tokens?: number;
  };
  options: {
    target_url?: string;
    include_comments: boolean;
    include_assertions: boolean;
    test_framework: string;
  };
  suggested_variations?: string[];
  improvement_suggestions?: string[];
  // Feature #1500: Approval workflow
  approval: ApprovalInfo;
  created_at: Date;
  updated_at: Date;
}

// Request body for saving a generated test
export interface SaveGeneratedTestBody {
  description: string;
  generated_code: string;
  test_name: string;
  language: 'typescript' | 'javascript';
  confidence_score: number;
  version?: number;
  parent_version_id?: string;
  feedback?: string;
  ai_metadata: {
    provider: string;
    model: string;
    used_real_ai: boolean;
    input_tokens?: number;
    output_tokens?: number;
  };
  options: {
    target_url?: string;
    include_comments: boolean;
    include_assertions: boolean;
    test_framework: string;
  };
  suggested_variations?: string[];
  improvement_suggestions?: string[];
  project_id?: string;
}

// Query parameters for history endpoint
export interface GenerationHistoryQuery {
  project_id?: string;
  limit?: number;
  offset?: number;
  description_search?: string;
  approval_status?: ApprovalStatus; // Filter by approval status
}

// Request body for approving/rejecting a test
export interface ApproveTestBody {
  action: 'approve' | 'reject';
  comment?: string;
  add_to_suite_id?: string; // Optional: add approved test to this suite
}

// Response for the review queue
export interface ReviewQueueResponse {
  pending: AIGeneratedTest[];
  total_pending: number;
  recently_reviewed: AIGeneratedTest[];
}

// Response type for generation history
export interface GenerationHistoryResponse {
  items: AIGeneratedTest[];
  total: number;
  limit: number;
  offset: number;
}

// Version chain for a specific description
export interface VersionChain {
  description: string;
  versions: AIGeneratedTest[];
  latest_version: number;
}
