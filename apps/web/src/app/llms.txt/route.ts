import { readFileSync } from 'fs';
import { resolve } from 'path';

import { NextResponse } from 'next/server';

let cachedContent: string | null = null;

function getContent(): string {
  if (cachedContent) return cachedContent;
  const filePath = resolve(process.cwd(), '..', '..', 'llms.txt');
  cachedContent = readFileSync(filePath, 'utf-8');
  return cachedContent;
}

export async function GET() {
  try {
    const content = getContent();
    return new NextResponse(content, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch {
    // Fallback: serve a redirect to the GitHub-hosted version
    return NextResponse.redirect('https://github.com/madfam-org/dhanam/blob/main/llms.txt', 302);
  }
}
