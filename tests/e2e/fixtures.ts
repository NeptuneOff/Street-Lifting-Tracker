import { test as base, expect, type BrowserContext } from '@playwright/test';
import { seedRecords } from '../../src/lib/seed';
import type { RemoteRecord } from '../../src/lib/types';
export const PROJECT = 'https://private-test.supabase.co';
export const A = '11111111-1111-4111-8111-111111111111',
  B = '22222222-2222-4222-8222-222222222222';
export const AUTH_KEY = `streetlift-auth:${encodeURIComponent(PROJECT)}`;
const user = (id: string) => ({
  id,
  aud: 'authenticated',
  role: 'authenticated',
  email: id === A ? 'karl@example.test' : 'bob@example.test',
  user_metadata: { name: id === A ? 'Karl' : 'Bob' },
  app_metadata: { provider: 'email', providers: ['email'] },
  created_at: new Date().toISOString(),
});
export function session(id: string) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token =
    [
      { alg: 'HS256', typ: 'JWT' },
      { sub: id, aud: 'authenticated', role: 'authenticated', exp: expires },
    ]
      .map((v) => Buffer.from(JSON.stringify(v)).toString('base64url'))
      .join('.') + '.test-signature';
  return {
    access_token: token,
    refresh_token: `test-refresh-${id}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expires,
    user: user(id),
  };
}
interface Backend {
  records: Map<string, Map<string, RemoteRecord>>;
  holdNextRead: (id: string) => () => void;
}
export async function mockBackend(context: BrowserContext, signedIn = true): Promise<Backend> {
  const records = new Map<string, Map<string, RemoteRecord>>([
    [
      A,
      new Map(
        seedRecords({ name: 'Karl', blank: false }).map((r) => [
          r.id,
          {
            id: r.id,
            kind: r.kind,
            payload: r.payload,
            version: r.version,
            deleted: r.deleted,
            updated_at: r.updatedAt,
          },
        ]),
      ),
    ],
    [B, new Map()],
  ]);
  const held = new Map<string, Promise<void>>();
  const backend: Backend = {
    records,
    holdNextRead(id) {
      let release!: () => void;
      held.set(
        id,
        new Promise<void>((r) => {
          release = r;
        }),
      );
      return release;
    },
  };
  await context.route(`${PROJECT}/**`, async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    let id = '';
    try {
      id = JSON.parse(
        Buffer.from((request.headers().authorization || '').split('.')[1], 'base64url').toString(),
      ).sub;
    } catch {
      /* Anonymous. */
    }
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname.endsWith('/auth/v1/token')) {
      const body = request.postDataJSON();
      const account = body.email === 'bob@example.test' ? B : A;
      if (body.password && body.password !== 'correct-horse-123')
        return json(
          { error: 'invalid_grant', error_description: 'Invalid login credentials' },
          400,
        );
      return json(session(account));
    }
    if (url.pathname.endsWith('/auth/v1/user'))
      return id ? json(user(id)) : json({ message: 'Invalid JWT' }, 401);
    if (url.pathname.endsWith('/auth/v1/logout')) return route.fulfill({ status: 204, body: '' });
    if (url.pathname.endsWith('/auth/v1/otp')) return json({});
    if (url.pathname.endsWith('/auth/v1/signup')) return json({ ...user(B), identities: [] });
    if (!id || !records.has(id)) return json({ message: 'JWT required' }, 401);
    const own = records.get(id)!;
    if (url.pathname.endsWith('/rest/v1/training_records')) {
      const wait = held.get(id);
      if (wait) {
        held.delete(id);
        await wait;
      }
      return json([...own.values()]);
    }
    if (url.pathname.endsWith('/rest/v1/rpc/push_training_record')) {
      const p = request.postDataJSON(),
        current = own.get(p.p_id);
      if (current && current.version !== p.p_base_version && current.version !== p.p_version)
        return json({ accepted: false, record: current });
      const record = {
        id: p.p_id,
        kind: p.p_kind,
        payload: p.p_payload,
        version: p.p_version,
        deleted: p.p_deleted,
        updated_at: new Date().toISOString(),
      };
      own.set(record.id, record);
      return json({ accepted: true, record });
    }
    return json({ message: 'Unexpected endpoint' }, 404);
  });
  await context.addInitScript(
    ({ project, key, authKey, initialSession, signedIn }) => {
      localStorage.setItem('streetlift-cloud', JSON.stringify({ url: project, key }));
      if (!localStorage.getItem('streetlift-test-initialized')) {
        localStorage.setItem('streetlift-test-initialized', 'true');
        if (signedIn) localStorage.setItem(authKey, JSON.stringify(initialSession));
      }
    },
    {
      project: PROJECT,
      key: 'sb_publishable_test',
      authKey: AUTH_KEY,
      initialSession: session(A),
      signedIn,
    },
  );
  return backend;
}
export const test = base.extend<{ backend: Backend }>({
  backend: [
    async ({ context }, use) => {
      await use(await mockBackend(context));
    },
    { auto: true },
  ],
});
export { expect };
