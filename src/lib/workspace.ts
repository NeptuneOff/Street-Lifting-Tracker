export interface WorkspaceIdentity {
  project: string;
  userId: string;
  name: string;
  email: string;
  mode?: 'private' | 'demo';
}
export class WorkspaceChangedError extends Error {
  constructor() {
    super('Le compte actif a changé. Opération annulée.');
  }
}
export function workspaceKey(identity: Pick<WorkspaceIdentity, 'project' | 'userId' | 'mode'>) {
  const project = new URL(identity.project).origin;
  if (!identity.userId) throw new Error('Connexion requise.');
  return `${identity.mode === 'demo' ? 'demo:' : ''}${encodeURIComponent(project)}:${encodeURIComponent(identity.userId)}`;
}

export const DEMO_IDENTITY: WorkspaceIdentity = {
  project: 'https://demo.streetlift.invalid',
  userId: 'public-demo-v1',
  name: 'Alex',
  email: '',
  mode: 'demo',
};
