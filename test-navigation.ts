// Test navigation detection patterns

/** Decode HTML entities in a string */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/** Recursively extract visible text from HTML content */
function extractNestedText(html: string): string {
  let cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<svg[\s\S]*?<\/svg>/gi, '');
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(cleaned).replace(/\s+/g, ' ').trim();
}

interface NavigationInfo {
  hasHeader: boolean;
  hasFooter: boolean;
  hasSidebar: boolean;
  menuItems: string[];
}

function extractNavigation(html: string): NavigationInfo {
  const hasHeader = /<header|<nav|role=["']?banner|role=["']?navigation/i.test(html);
  const hasFooter = /<footer|role=["']?contentinfo/i.test(html);
  const hasSidebar = /<aside|sidebar|role=["']?complementary/i.test(html);

  const extractLinksFromContent = (content: string): string[] => {
    return [...content.matchAll(/<a\s+([^>]*)>([\s\S]*?)<\/a>/gi)].map(a => {
      const attrs = a[1] || '';
      const linkContent = a[2] || '';
      const ariaLabelRaw = attrs.match(/aria-label=["']([^"']+)["']/i)?.[1];
      const ariaLabel = ariaLabelRaw ? decodeHtmlEntities(ariaLabelRaw) : undefined;
      const titleAttrRaw = attrs.match(/title=["']([^"']+)["']/i)?.[1];
      const titleAttr = titleAttrRaw ? decodeHtmlEntities(titleAttrRaw) : undefined;
      const nestedText = extractNestedText(linkContent);
      return (ariaLabel || titleAttr || nestedText || '').trim();
    });
  };

  const allMenuItems: string[] = [];

  // 1. Standard <nav> elements
  const navMatches = [...html.matchAll(/<nav[^>]*>([\s\S]*?)<\/nav>/gi)];
  for (const m of navMatches) {
    allMenuItems.push(...extractLinksFromContent(m[1] || ''));
  }

  // 2. Elements with role="navigation"
  const roleNavMatches = [...html.matchAll(/<(?:div|ul|section|aside)[^>]*role=["']navigation["'][^>]*>([\s\S]*?)<\/(?:div|ul|section|aside)>/gi)];
  for (const m of roleNavMatches) {
    allMenuItems.push(...extractLinksFromContent(m[1] || ''));
  }

  // 3. Header menus
  const headerMatches = [...html.matchAll(/<header[^>]*>([\s\S]*?)<\/header>/gi)];
  for (const m of headerMatches) {
    allMenuItems.push(...extractLinksFromContent(m[1] || ''));
  }

  // 4. Common CSS class patterns
  const navClassPatterns = [
    /class=["'][^"']*(?:navbar|nav-menu|main-nav|site-nav|header-nav|primary-nav|global-nav)[^"']*["']/i,
    /class=["'][^"']*(?:navigation|menu-container|menu-wrapper|top-nav|main-menu)[^"']*["']/i,
  ];
  for (const pattern of navClassPatterns) {
    const classRegex = new RegExp(`<(?:div|ul|nav)[^>]*${pattern.source}[^>]*>([\\s\\S]*?)<\\/(?:div|ul|nav)>`, 'gi');
    const matches = [...html.matchAll(classRegex)];
    for (const m of matches) {
      allMenuItems.push(...extractLinksFromContent(m[1] || ''));
    }
  }

  // 5. ul.menu and ul.nav patterns
  const ulMenuMatches = [...html.matchAll(/<ul[^>]*class=["'][^"']*(?:\bmenu\b|\bnav\b|\bnavbar-nav\b)[^"']*["'][^>]*>([\s\S]*?)<\/ul>/gi)];
  for (const m of ulMenuMatches) {
    allMenuItems.push(...extractLinksFromContent(m[1] || ''));
  }

  // 6. Aside/sidebar navigation
  const asideMatches = [...html.matchAll(/<aside[^>]*>([\s\S]*?)<\/aside>/gi)];
  for (const m of asideMatches) {
    allMenuItems.push(...extractLinksFromContent(m[1] || ''));
  }

  // 7. Footer navigation
  const footerMatches = [...html.matchAll(/<footer[^>]*>([\s\S]*?)<\/footer>/gi)];
  for (const m of footerMatches) {
    allMenuItems.push(...extractLinksFromContent(m[1] || ''));
  }

  const uniqueMenuItems = [...new Set(allMenuItems)]
    .filter(item => item && item.length > 0 && item.length < 100)
    .slice(0, 30);

  return { hasHeader, hasFooter, hasSidebar, menuItems: uniqueMenuItems };
}

// Test cases
const testCases = [
  {
    name: "Standard nav element",
    html: '<nav><a href="/home">Home</a><a href="/about">About</a></nav>',
    expectMenuItems: ["Home", "About"],
    expectHasHeader: true
  },
  {
    name: "div with role=navigation",
    html: '<div role="navigation"><a href="/products">Products</a><a href="/services">Services</a></div>',
    expectMenuItems: ["Products", "Services"],
    expectHasHeader: true
  },
  {
    name: "Header menu",
    html: '<header><a href="/logo">Logo</a><a href="/menu">Menu</a></header>',
    expectMenuItems: ["Logo", "Menu"],
    expectHasHeader: true
  },
  {
    name: "ul.menu (WordPress style)",
    html: '<ul class="menu"><li><a href="/page1">Page 1</a></li><li><a href="/page2">Page 2</a></li></ul>',
    expectMenuItems: ["Page 1", "Page 2"],
    expectHasHeader: false
  },
  {
    name: "ul.nav (Bootstrap style)",
    html: '<ul class="nav navbar-nav"><li><a href="/a">A</a></li><li><a href="/b">B</a></li></ul>',
    expectMenuItems: ["A", "B"],
    expectHasHeader: false
  },
  {
    name: "div.navbar class",
    html: '<div class="navbar main-nav"><a href="/shop">Shop</a></div>',
    expectMenuItems: ["Shop"],
    expectHasHeader: false
  },
  {
    name: "Aside sidebar",
    html: '<aside><a href="/sidebar1">Sidebar Link 1</a></aside>',
    expectMenuItems: ["Sidebar Link 1"],
    expectHasSidebar: true
  },
  {
    name: "Footer navigation",
    html: '<footer><a href="/privacy">Privacy</a><a href="/terms">Terms</a></footer>',
    expectMenuItems: ["Privacy", "Terms"],
    expectHasFooter: true
  },
  {
    name: "role=complementary (sidebar)",
    html: '<div role="complementary"><a href="/related">Related</a></div>',
    expectHasSidebar: true
  },
  {
    name: "role=contentinfo (footer)",
    html: '<div role="contentinfo"><a href="/copyright">Copyright</a></div>',
    expectHasFooter: true
  },
  {
    name: "Combined navigation (no duplicates)",
    html: `
      <nav><a href="/home">Home</a></nav>
      <header><a href="/home">Home</a><a href="/about">About</a></header>
    `,
    expectMenuItems: ["Home", "About"] // Home should be deduplicated
  }
];

console.log("Testing navigation detection patterns:\n");
let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const result = extractNavigation(tc.html);
  let success = true;
  const issues: string[] = [];

  if (tc.expectMenuItems) {
    const menuMatches = tc.expectMenuItems.every(item => result.menuItems.includes(item));
    if (!menuMatches) {
      success = false;
      issues.push(`Expected menu items [${tc.expectMenuItems.join(", ")}], got [${result.menuItems.join(", ")}]`);
    }
  }

  if (tc.expectHasHeader !== undefined && result.hasHeader !== tc.expectHasHeader) {
    success = false;
    issues.push(`Expected hasHeader=${tc.expectHasHeader}, got ${result.hasHeader}`);
  }

  if (tc.expectHasFooter !== undefined && result.hasFooter !== tc.expectHasFooter) {
    success = false;
    issues.push(`Expected hasFooter=${tc.expectHasFooter}, got ${result.hasFooter}`);
  }

  if (tc.expectHasSidebar !== undefined && result.hasSidebar !== tc.expectHasSidebar) {
    success = false;
    issues.push(`Expected hasSidebar=${tc.expectHasSidebar}, got ${result.hasSidebar}`);
  }

  if (success) {
    console.log(`✅ ${tc.name}: menuItems=[${result.menuItems.join(", ")}]`);
    passed++;
  } else {
    console.log(`❌ ${tc.name}: ${issues.join("; ")}`);
    failed++;
  }
}

console.log(`\nResults: ${passed}/${passed + failed} tests passed`);
