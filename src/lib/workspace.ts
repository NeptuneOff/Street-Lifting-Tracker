export interface WorkspaceIdentity {
  project: string;
  userId: string;
  name: string;
  email: string;
}
export class WorkspaceChangedError extends Error {
  constructor() {
    super('Le compte actif a changé. Opération annulée.');
  }
}
export function workspaceKey(identity: Pick<WorkspaceIdentity, 'project' | 'userId'>) {
  const project = new URL(identity.project).origin;
  if (!identity.userId) throw new Error('Connexion requise.');
  return `${encodeURIComponent(project)}:${encodeURIComponent(identity.userId)}`;
}
