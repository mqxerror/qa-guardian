import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Spotlight,
  TextGenerateEffect,
  HoverEffect,
  HoverBorderGradient,
  BackgroundBeams
} from '../components/aceternity';
import {
  Shield,
  Zap,
  Eye,
  Bot,
  BarChart3,
  Lock,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

const features = [
  {
    title: "E2E Testing",
    description: "Full browser automation with Playwright. Record, playback, and heal tests automatically with AI assistance.",
    icon: <Zap className="h-5 w-5 text-blue-400" />,
  },
  {
    title: "Visual Regression",
    description: "Detect visual changes with pixel-perfect comparisons. AI-powered baseline management and approval workflows.",
    icon: <Eye className="h-5 w-5 text-purple-400" />,
  },
  {
    title: "AI-Powered Testing",
    description: "170+ MCP tools for AI agent integration. Claude generates, heals, and analyzes tests automatically.",
    icon: <Bot className="h-5 w-5 text-green-400" />,
  },
  {
    title: "Security Scanning",
    description: "DAST scanning with OWASP ZAP, secret detection with Gitleaks, and dependency vulnerability analysis.",
    icon: <Shield className="h-5 w-5 text-red-400" />,
  },
  {
    title: "Performance Testing",
    description: "Load testing with K6, performance audits with Lighthouse, and real user monitoring dashboards.",
    icon: <BarChart3 className="h-5 w-5 text-yellow-400" />,
  },
  {
    title: "Accessibility Audits",
    description: "WCAG 2.1 compliance scanning with axe-core. Automated accessibility reports and remediation guidance.",
    icon: <Lock className="h-5 w-5 text-cyan-400" />,
  },
];

const stats = [
  { label: "MCP Tools", value: "170+" },
  { label: "Test Types", value: "5" },
  { label: "AI Models", value: "3" },
  { label: "Uptime", value: "99.9%" },
];

export function HomePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-hidden">
      {/* Hero Section */}
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
        {/* Background Effects */}
        <Spotlight
          className="-top-40 left-0 md:-top-20 md:left-60"
          fill="rgb(59, 130, 246)"
        />
        <BackgroundBeams className="opacity-40" />

        {/* Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

        {/* Hero Content */}
        <div className="relative z-10 mx-auto max-w-7xl px-4 pt-20 pb-16 text-center md:pt-0">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
              </span>
              AI-Native Test Platform
            </span>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-gradient-to-b from-white to-gray-400 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl md:text-7xl"
          >
            QA Guardian
          </motion.h1>

          {/* Animated Tagline */}
          <div className="mt-6">
            <TextGenerateEffect
              words="All tests. One platform. AI-ready."
              className="text-xl text-gray-400 md:text-2xl"
              duration={0.3}
            />
          </div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mx-auto mt-6 max-w-2xl text-base text-gray-500 md:text-lg"
          >
            Unified test management for E2E, visual regression, load testing, accessibility audits,
            and security scanning. Built with Claude AI and 170+ MCP tools.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link to="/register">
              <HoverBorderGradient
                containerClassName="rounded-full"
                className="flex items-center gap-2 bg-gray-950 px-6 py-2 text-white"
              >
                <span>Get Started Free</span>
                <ArrowRight className="h-4 w-4" />
              </HoverBorderGradient>
            </Link>
            <Link
              to="/login"
              className="group flex items-center gap-2 rounded-full border border-gray-700 bg-gray-900/50 px-6 py-2.5 text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
            >
              <span>Sign In</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-16 grid grid-cols-2 gap-8 md:grid-cols-4"
          >
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl font-bold text-white md:text-4xl">{stat.value}</div>
                <div className="mt-1 text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex flex-col items-center gap-2"
          >
            <span className="text-xs text-gray-600">Scroll to explore</span>
            <div className="h-8 w-5 rounded-full border border-gray-700 p-1">
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="h-2 w-2 rounded-full bg-blue-500"
              />
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Features Section */}
      <div className="relative bg-gray-950 py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center">
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-sm font-medium text-blue-500"
            >
              Comprehensive Testing
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="mt-2 text-3xl font-bold text-white md:text-4xl"
            >
              Everything You Need to Ship Quality Software
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="mx-auto mt-4 max-w-2xl text-gray-400"
            >
              One platform for all your testing needs. From functional testing to security scanning,
              powered by AI for maximum efficiency.
            </motion.p>
          </div>

          <HoverEffect items={features} className="mt-12" />
        </div>
      </div>

      {/* Why QA Guardian Section */}
      <div className="relative bg-gray-900/50 py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid gap-12 md:grid-cols-2">
            <div>
              <motion.span
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="text-sm font-medium text-blue-500"
              >
                Why QA Guardian?
              </motion.span>
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="mt-2 text-3xl font-bold text-white md:text-4xl"
              >
                Built for Modern Teams
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="mt-4 text-gray-400"
              >
                QA Guardian bridges the gap between human QA engineers and AI agents.
                Visual recorder for humans, MCP tools for AI - everyone speaks the same language.
              </motion.p>

              <motion.ul
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="mt-8 space-y-4"
              >
                {[
                  "MCP-native with 170+ tools for AI agent integration",
                  "All test types unified in one platform",
                  "AI-powered test generation, healing, and analysis",
                  "Visual recorder for QA engineers, API for automation",
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-500" />
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </motion.ul>
            </div>

            <div className="relative">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl border border-gray-800 bg-gray-900/80 p-6 backdrop-blur-sm"
              >
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500" />
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="ml-2 text-sm text-gray-500">terminal</span>
                </div>
                <pre className="overflow-x-auto text-sm">
                  <code className="text-gray-300">
                    <span className="text-green-400">$</span> qa-guardian test run{'\n'}
                    <span className="text-gray-500"># Running test suite...</span>{'\n'}
                    <span className="text-blue-400">✓</span> Login flow <span className="text-gray-500">(1.2s)</span>{'\n'}
                    <span className="text-blue-400">✓</span> Dashboard loads <span className="text-gray-500">(0.8s)</span>{'\n'}
                    <span className="text-blue-400">✓</span> Visual regression <span className="text-gray-500">(2.1s)</span>{'\n'}
                    <span className="text-blue-400">✓</span> A11y audit passed <span className="text-gray-500">(1.5s)</span>{'\n'}
                    <span className="text-blue-400">✓</span> Security scan clean <span className="text-gray-500">(3.2s)</span>{'\n'}
                    {'\n'}
                    <span className="text-green-400">All 5 tests passed!</span>{'\n'}
                    <span className="text-gray-500">Time: 8.8s</span>
                  </code>
                </pre>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative py-24">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl font-bold text-white md:text-4xl"
          >
            Ready to Transform Your QA?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto mt-4 max-w-2xl text-gray-400"
          >
            Start testing smarter with AI-powered automation. No credit card required.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-8"
          >
            <Link to="/register">
              <HoverBorderGradient
                containerClassName="rounded-full"
                className="flex items-center gap-2 bg-gray-950 px-8 py-3 text-white"
              >
                <span>Start Free Trial</span>
                <ArrowRight className="h-4 w-4" />
              </HoverBorderGradient>
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-gray-950 py-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="text-xl font-bold text-white">QA Guardian</div>
            <div className="text-sm text-gray-500">
              © 2026 QA Guardian. All rights reserved.
            </div>
            <div className="flex gap-6">
              <a href="#" className="text-gray-500 hover:text-white transition-colors">Privacy</a>
              <a href="#" className="text-gray-500 hover:text-white transition-colors">Terms</a>
              <a href="#" className="text-gray-500 hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
