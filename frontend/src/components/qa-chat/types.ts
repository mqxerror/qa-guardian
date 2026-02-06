// Feature #1441: Split App.tsx into logical modules
// ChatMessage interface extracted from QAChatWidget.tsx

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: {
    type: 'test_results' | 'explanation' | 'action_result' | 'text' | 'debug_analysis' | 'suggestions' | 'screenshot_analysis';
    tests?: Array<{
      id: string;
      name: string;
      status: 'passed' | 'failed' | 'flaky';
      suite: string;
      duration: number;
      error?: string;
      timestamp: string;
    }>;
    explanation?: {
      summary: string;
      root_cause: string;
      evidence: string[];
      fix_suggestion: string;
    };
    action?: {
      type: 'fix_applied' | 'test_triggered' | 'test_running' | 'test_completed';
      details: string;
      success?: boolean;
    };
    debug?: {
      test_name?: string;
      total_steps?: number;
      failed_step?: number;
      steps: Array<{
        number: number;
        action: string;
        status: 'passed' | 'failed' | 'pending' | 'skipped';
        duration: number;
        error?: string;
        screenshot?: boolean;
      }>;
      failure_details?: {
        step: number;
        reason: string;
        error?: string;
        stack_trace?: string;
      };
    };
    suggestions?: Array<{
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      confidence: number;
      code?: string;
    }>;
    analysis?: {
      page_type: {
        identified: string;
        category: string;
        confidence: number;
      };
      elements_detected: Array<{
        type: string;
        count?: number;
        description?: string;
        label?: string;
        role?: string;
        selector?: string;
      }>;
      errors_detected: Array<{
        severity: 'error' | 'warning';
        message: string;
        location: string;
      }>;
      visual_state: {
        has_overlay: boolean;
        theme: string;
        responsive_view: string;
        has_loading_spinner?: boolean;
        has_modal?: boolean;
      };
      semantic_description: string;
      suggested_test_assertions?: string[];
    };
  };
}
