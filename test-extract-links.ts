// Test the parsing logic directly
function extractNestedText(html: string): string {
  let cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, "");
  cleaned = cleaned.replace(/<svg[\s\S]*?<\/svg>/gi, "");
  cleaned = cleaned.replace(/<[^>]+>/g, " ");
  cleaned = cleaned
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
  return cleaned.replace(/\s+/g, " ").trim();
}

interface LinkInfo { text: string; href: string; isExternal: boolean; isNavigation: boolean; }

function extractLinks(html: string, baseUrl: string): LinkInfo[] {
  const baseHost = new URL(baseUrl).hostname;
  return [...html.matchAll(/<a\s+([^>]*)>([\s\S]*?)<\/a>/gi)]
    .map(m => {
      const attrs = m[1] || "";
      const content = m[2] || "";
      const hrefMatch = attrs.match(/href=["']?([^"'\s>]+)/i);
      const href = hrefMatch?.[1] || "";
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return null;
      const ariaLabel = attrs.match(/aria-label=["']([^"']+)["']/i)?.[1];
      const titleAttr = attrs.match(/title=["']([^"']+)["']/i)?.[1];
      const nestedText = extractNestedText(content);
      const imgAlt = content.match(/<img[^>]*alt=["']([^"']+)["']/i)?.[1];
      const imgTitle = content.match(/<img[^>]*title=["']([^"']+)["']/i)?.[1];
      const nestedAriaLabel = content.match(/aria-label=["']([^"']+)["']/i)?.[1];
      const text = (ariaLabel || titleAttr || nestedText || imgAlt || imgTitle || nestedAriaLabel || "").trim();
      return {
        text, href,
        isExternal: href.startsWith("http") && !href.includes(baseHost),
        isNavigation: /nav|menu|header/i.test(attrs) || /nav|menu|header/i.test(text),
      };
    })
    .filter((link): link is LinkInfo => link !== null && link.href.length > 0)
    .slice(0, 50);
}

// Test cases
const testCases = [
  {
    name: "Nested spans and icons",
    html: '<a href="/shop"><span class="icon">🛍️</span><span class="label">Shop Now</span></a>',
    expected: "🛍️ Shop Now"
  },
  {
    name: "aria-label on link",
    html: '<a href="/products" aria-label="Browse Products"><span>🛍️</span></a>',
    expected: "Browse Products"
  },
  {
    name: "Image with alt text",
    html: '<a href="/about"><img src="icon.svg" alt="About Us"></a>',
    expected: "About Us"
  },
  {
    name: "Nested div with text",
    html: '<a href="/contact"><div class="menu-item"><span>Contact</span><small>Us</small></div></a>',
    expected: "Contact Us"
  },
  {
    name: "SVG icon removed",
    html: '<a href="/home"><svg><path d="..."/></svg>Home</a>',
    expected: "Home"
  },
  {
    name: "title attribute",
    html: '<a href="/help" title="Get Help"><svg></svg></a>',
    expected: "Get Help"
  },
  {
    name: "Shopify-style menu",
    html: '<a href="/collections/sale" class="site-nav--link"><span class="site-nav--label">Sale</span></a>',
    expected: "Sale"
  },
  {
    name: "React site with nested components",
    html: '<a href="/dashboard"><div><span aria-hidden="true">📊</span><span>Dashboard</span></div></a>',
    expected: "📊 Dashboard"
  }
];

console.log("Testing extractLinks with nested content:\n");
let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const result = extractLinks(tc.html, "https://example.com");
  const text = result[0]?.text || "";
  const success = text === tc.expected;
  if (success) {
    console.log(`✅ ${tc.name}: "${text}"`);
    passed++;
  } else {
    console.log(`❌ ${tc.name}: got "${text}", expected "${tc.expected}"`);
    failed++;
  }
}

console.log(`\nResults: ${passed}/${passed + failed} tests passed`);
