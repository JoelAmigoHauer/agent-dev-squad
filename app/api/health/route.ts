import { ok } from '@/lib/api/respond';

/** Stage 6's deploy probe. Deliberately the one route with no screen behind it. */
export async function GET() {
  return ok({
    ok: true,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
    migrations: 3,
  });
}
