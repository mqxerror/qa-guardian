// Script to extract TestDetailPage from App.tsx
const fs = require('fs');
const path = require('path');

const appTsxPath = path.join(__dirname, '../frontend/src/App.tsx');
const outputPath = path.join(__dirname, '../frontend/src/pages/TestDetailPage.tsx');

// Read App.tsx
const content = fs.readFileSync(appTsxPath, 'utf8');
const lines = content.split('\n');

// Extract interfaces (lines 2248-2469, 0-indexed: 2247-2468) and TestDetailPage function (2471-12155, 0-indexed: 2470-12154)
const interfaceLines = lines.slice(2247, 2469); // Lines 2248-2469
const testDetailLines = lines.slice(2470, 12155); // Lines 2471-12155

// Create imports header
const imports = `// TestDetailPage - Extracted from App.tsx
// Feature #1441: Split App.tsx into logical modules
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useTimezoneStore } from '../stores/timezoneStore';
import { useSocketStore } from '../stores/socketStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useToastStore, toast } from '../stores/toastStore';
import { useVisualReviewStore } from '../stores/visualReviewStore';
import { getErrorMessage, isNetworkError, isOffline } from '../utils/errorHandling';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import jsPDF from 'jspdf';

// Types used by TestDetailPage
interface TestSuite {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  test_count?: number;
  browser?: string;
  viewport_width?: number;
  viewport_height?: number;
  timeout?: number;
  retry_count?: number;
  project_id?: string;
}

interface TestType {
  id: string;
  suite_id: string;
  name: string;
  description?: string;
  type: 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility' | 'api';
  test_type?: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'error' | 'active' | 'draft';
  created_at: string;
  updated_at: string;
  last_run_at?: string;
  target_url?: string;
  viewport_width?: number;
  viewport_height?: number;
  capture_mode?: 'full_page' | 'viewport' | 'element';
  element_selector?: string;
  wait_for_selector?: string;
  wait_time?: number;
  hide_selectors?: string[];
  remove_selectors?: string[];
  diff_threshold?: number;
  diff_threshold_mode?: 'percentage' | 'pixel_count';
  diff_pixel_threshold?: number;
  anti_aliasing_tolerance?: 'off' | 'low' | 'medium' | 'high';
  color_threshold?: number;
  ignore_regions?: Array<{id: string; x: number; y: number; width: number; height: number; name?: string}>;
  ignore_selectors?: string[];
  multi_viewport?: boolean;
  selected_viewports?: string[];
  steps?: any[];
  device_preset?: 'mobile' | 'desktop';
  performance_threshold?: number;
  lcp_threshold?: number;
  cls_threshold?: number;
  bypass_csp?: boolean;
  ignore_ssl_errors?: boolean;
  audit_timeout?: number;
  wcag_level?: 'A' | 'AA' | 'AAA';
  include_best_practices?: boolean;
  include_experimental?: boolean;
  include_pa11y?: boolean;
  a11y_fail_on_critical?: number;
  a11y_fail_on_serious?: number;
  a11y_fail_on_moderate?: number;
  a11y_fail_on_minor?: number;
  a11y_fail_on_any?: boolean;
  virtual_users?: number;
  duration?: number;
  ramp_up_time?: number;
  k6_script?: string;
  ai_generated?: boolean;
  ai_confidence_score?: number;
  requires_review?: boolean;
  review_status?: 'pending' | 'approved' | 'rejected' | 'pending_review';
  reviewed_by?: string;
  reviewed_at?: string;
  healing_active?: boolean;
  healing_status?: 'idle' | 'healing' | 'healed';
  healing_count?: number;
}

`;

// Combine imports with extracted interfaces and function, then add export
const outputContent = imports + interfaceLines.join('\n') + '\n\n' + testDetailLines.join('\n') + '\n\nexport { TestDetailPage };\n';

// Write the file
fs.writeFileSync(outputPath, outputContent);

console.log('Successfully extracted TestDetailPage to:', outputPath);
console.log('Interface lines extracted:', interfaceLines.length);
console.log('Function lines extracted:', testDetailLines.length);
console.log('Total lines in new file:', outputContent.split('\n').length);
