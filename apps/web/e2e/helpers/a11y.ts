import { Page, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export interface A11yResult {
  violations: Array<{
    id: string;
    impact: string;
    description: string;
    nodes: Array<{ html: string; target: string[] }>;
  }>;
}

/**
 * Run axe-core accessibility checks on the current page.
 * Fails the test if any WCAG AA violations are found.
 */
export async function checkA11y(
  page: Page,
  options?: {
    /** CSS selector to scope the analysis */
    include?: string;
    /** Axe rule IDs to skip (e.g. known false positives) */
    disableRules?: string[];
  }
): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

  if (options?.include) {
    builder = builder.include(options.include);
  }

  if (options?.disableRules?.length) {
    builder = builder.disableRules(options.disableRules);
  }

  const results = await builder.analyze();

  // Format violations for clear error output
  const violationMessages = results.violations.map((v) => {
    const nodes = v.nodes
      .slice(0, 3)
      .map((n) => `  - ${n.target.join(' > ')}`)
      .join('\n');
    return `[${v.impact}] ${v.id}: ${v.description}\n${nodes}`;
  });

  expect(
    results.violations,
    `Accessibility violations found:\n\n${violationMessages.join('\n\n')}`
  ).toHaveLength(0);
}
