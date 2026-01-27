// Script to extract TestSuitePage from App.tsx
const fs = require('fs');
const path = require('path');

const appTsxPath = path.join(__dirname, '../frontend/src/App.tsx');
const outputPath = path.join(__dirname, '../frontend/src/pages/TestSuitePage.tsx');

// Read App.tsx
const content = fs.readFileSync(appTsxPath, 'utf8');
const lines = content.split('\n');

// Extract lines 2243-9762 (0-indexed: 2242-9761)
const testSuiteLines = lines.slice(2242, 9762);

// Create imports header
const imports = `// TestSuitePage - Extracted from App.tsx
// Feature #1441: Split App.tsx into logical modules
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useTimezoneStore } from '../stores/timezoneStore';
import { useToastStore, toast } from '../stores/toastStore';
import { getErrorMessage, isNetworkError, isOffline } from '../utils/errorHandling';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import jsPDF from 'jspdf';

// Types
interface TestSuite {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  test_count?: number;
}

interface TestType {
  id: string;
  suite_id: string;
  name: string;
  description?: string;
  type: 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility';
  status: 'pending' | 'running' | 'passed' | 'failed' | 'error';
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
  // Lighthouse specific
  device_preset?: 'mobile' | 'desktop';
  performance_threshold?: number;
  lcp_threshold?: number;
  cls_threshold?: number;
  bypass_csp?: boolean;
  ignore_ssl_errors?: boolean;
  audit_timeout?: number;
  // Accessibility specific
  wcag_level?: 'A' | 'AA' | 'AAA';
  include_best_practices?: boolean;
  include_experimental?: boolean;
  include_pa11y?: boolean;
  a11y_fail_on_critical?: number;
  a11y_fail_on_serious?: number;
  a11y_fail_on_moderate?: number;
  a11y_fail_on_minor?: number;
  a11y_fail_on_any?: boolean;
  // Load test specific
  virtual_users?: number;
  duration?: number;
  ramp_up_time?: number;
  k6_script?: string;
  // AI generation metadata
  ai_generated?: boolean;
  ai_confidence_score?: number;
  requires_review?: boolean;
  review_status?: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
}

`;

// Combine imports with extracted code and add export
const outputContent = imports + testSuiteLines.join('\n') + '\n\nexport { TestSuitePage };\n';

// Write the file
fs.writeFileSync(outputPath, outputContent);

console.log('Successfully extracted TestSuitePage to:', outputPath);
console.log('Lines extracted:', testSuiteLines.length);
