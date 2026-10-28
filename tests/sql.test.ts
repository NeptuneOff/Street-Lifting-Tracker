import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
const A = '11111111-1111-4111-8111-111111111111',
  B = '22222222-2222-4222-8222-222222222222';
const db = new PGlite();
const as = async (user: string, role = 'authenticated') => {
  await db.exec(`reset role; set role ${role};`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
};
beforeAll(async () => {
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth, public to anon, authenticated; grant execute on function auth.uid() to anon, authenticated; insert into auth.users values('${A}'),('${B}');`,
  );
  for (const name of ['001_training_records.sql', '002_private_accounts.sql'])
    await db.exec(readFileSync(`supabase/migrations/${name}`, 'utf8'));
}, 20000);
afterAll(async () => {
  await db.close();
});
describe('isolation PostgreSQL réelle : deux comptes, accès direct et RPC', () => {
  it('permet deux programmes de même identifiant sans les mélanger', async () => {
    await as(A);
    await db.query("select public.push_training_record('monday','program',$1,false,null,$2)", [
      JSON.stringify({ id: 'monday', name: 'Programme privé A' }),
      crypto.randomUUID(),
    ]);
    await as(B);
    await db.query("select public.push_training_record('monday','program',$1,false,null,$2)", [
      JSON.stringify({ id: 'monday', name: 'Programme privé B' }),
      crypto.randomUUID(),
    ]);
    const result = await db.query<{ payload: { name: string } }>(
      'select payload from public.training_records',
    );
    expect(result.rows.map((r) => r.payload.name)).toEqual(['Programme privé B']);
  });
  it('refuse lecture, modification et insertion dans le compte A depuis B', async () => {
    await as(B);
    expect(
      (await db.query('select * from public.training_records where user_id=$1', [A])).rows,
    ).toEqual([]);
    expect(
      (
        await db.query(
          'update public.training_records set deleted=true where user_id=$1 returning id',
          [A],
        )
      ).rows,
    ).toEqual([]);
    await expect(
      db.query(
        "insert into public.training_records(user_id,id,kind,payload,version) values($1,'foreign','program','{\"id\":\"foreign\"}',$2)",
        [A, crypto.randomUUID()],
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it('ne permet pas à B de réaffecter une ligne vers A', async () => {
    await as(B);
    await expect(
      db.query("update public.training_records set user_id=$1 where id='monday'", [A]),
    ).rejects.toThrow(/row-level security/);
  });
  it('ne laisse pas une politique permissive ajoutée par erreur exposer les autres comptes', async () => {
    await db.exec(
      'reset role; create policy "accidental broad policy" on public.training_records for all to authenticated using (true) with check (true);',
    );
    await as(B);
    expect(
      (
        await db.query<{ user_id: string }>('select user_id from public.training_records')
      ).rows.every((r) => r.user_id === B),
    ).toBe(true);
  });
  it('bloque le rôle anonyme même avec un identifiant fourni', async () => {
    await as(A, 'anon');
    await expect(db.query('select * from public.training_records')).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.query(
        "select public.push_training_record('monday','program','{\"id\":\"monday\"}',false,null,$1)",
        [crypto.randomUUID()],
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it('ne donne aucun accès à authenticated sans identité', async () => {
    await as('');
    expect((await db.query('select * from public.training_records')).rows).toEqual([]);
    await expect(
      db.query(
        "select public.push_training_record('monday','program','{\"id\":\"monday\"}',false,null,$1)",
        [crypto.randomUUID()],
      ),
    ).rejects.toThrow(/Authentication required/);
  });
  it('conserve le programme original de A après les tentatives de B', async () => {
    await as(A);
    const result = await db.query<{ payload: { name: string }; deleted: boolean }>(
      'select payload,deleted from public.training_records',
    );
    expect(result.rows).toEqual([
      { payload: { id: 'monday', name: 'Programme privé A' }, deleted: false },
    ]);
  });
});
