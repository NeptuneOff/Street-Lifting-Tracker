export type Phase = 'Échauffement' | 'Montée' | 'Pic' | 'Volume' | 'Facultatif';
export type Intent = 'Force' | 'Volume' | 'Technique';
export interface Exercise {
  id: string;
  name: string;
  shortName: string;
  weighted: boolean;
  reference: number;
  reliability: 'Record réalisé' | 'Estimation' | 'À revalider';
}
export interface Block {
  id: string;
  phase: Phase;
  sets: number;
  reps: number;
  mode: 'fixed' | 'percent';
  load: number;
  percentBasis: 'total' | 'added';
  rest: number;
  optional: boolean;
}
export interface PlannedExercise {
  id: string;
  exerciseId: string;
  intent: Intent;
  blocks: Block[];
}
export interface Program {
  id: string;
  name: string;
  weekday: number;
  exercises: PlannedExercise[];
  skills: string;
}
export interface Profile {
  id: 'profile';
  name: string;
  bodyweight: number;
  category: number;
  increment: number;
  autoRest: boolean;
  sound: boolean;
}
export interface Weight {
  id: string;
  date: string;
  kg: number;
}
export interface ResolvedBlock extends Block {
  resolvedLoad: number;
}
export interface Result {
  load: number;
  sets: number;
  reps: number;
  rir: number | null;
  comment: string;
  confirmed: boolean;
}
export interface SessionExercise extends Omit<PlannedExercise, 'blocks'> {
  definition: Exercise;
  blocks: ResolvedBlock[];
  checked: string[];
  result: Result;
}
export interface TrainingSession {
  id: string;
  programId: string;
  programName: string;
  weekday: number;
  startedAt: string;
  endedAt: string | null;
  status: 'active' | 'completed';
  bodyweight: number;
  exercises: SessionExercise[];
  skills: string;
}
export type Kind = 'profile' | 'exercise' | 'program' | 'session' | 'weight';
export type Payload = Profile | Exercise | Program | TrainingSession | Weight;
export interface DataRecord {
  id: string;
  kind: Kind;
  payload: Payload;
  version: string;
  baseVersion: string | null;
  updatedAt: string;
  deleted: boolean;
  dirty: boolean;
  seeded?: boolean;
}
export interface Conflict {
  id: string;
  local: DataRecord;
  remote: RemoteRecord;
}
export interface RemoteRecord {
  id: string;
  kind: Kind;
  payload: Payload;
  version: string;
  deleted: boolean;
  updated_at: string;
}
export interface State {
  records: DataRecord[];
  ready: boolean;
  error: string;
  saving: boolean;
}
export const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
export const PHASES: Phase[] = ['Échauffement', 'Montée', 'Pic', 'Volume', 'Facultatif'];
