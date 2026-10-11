import { docsLlms } from '@/lib/source';

export const dynamic = 'force-static';

export async function GET(): Promise<Response> {
  return new Response(await docsLlms.full(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
