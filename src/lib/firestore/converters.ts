import { FirestoreDataConverter, serverTimestamp, Timestamp } from "firebase/firestore";

// ---- Types ----
export interface PublicProfile {
  displayName: string;
  points: number;
  updatedAt?: Date | null;
}

export interface TaskItem {
  text: string;
  completed: boolean;
  createdAt?: Date | null;
  remindAt?: Date | null;
  dueAt?: Date | null;
  source?: string; // origem (ex.: atividade-empty)
}

export interface AttemptRecord {
  templateId: string;
  startedAt?: Date | null;
  submittedAt?: Date | null;
  completedAt?: Date | null;
  payload: Record<string, unknown>;
  pointsAwarded?: number;
}

// ---- Helpers ----
function tsToDate(v: any): Date | null {
  return v instanceof Timestamp ? v.toDate() : null;
}

// ---- Converters ----
export const publicProfileConverter: FirestoreDataConverter<PublicProfile> = {
  toFirestore(profile: PublicProfile) {
    return {
      displayName: profile.displayName,
      points: profile.points,
      updatedAt: serverTimestamp(),
    };
  },
  fromFirestore(snapshot, options) {
    const data = snapshot.data(options) || {};
    return {
      displayName: typeof data.displayName === "string" ? data.displayName : "Aluno",
      points: typeof data.points === "number" ? data.points : 0,
      updatedAt: tsToDate(data.updatedAt),
    };
  },
};

export const taskItemConverter: FirestoreDataConverter<TaskItem> = {
  toFirestore(task: TaskItem) {
    return {
      text: task.text,
      completed: !!task.completed,
      createdAt: serverTimestamp(),
      remindAt: task.remindAt ?? null,
      dueAt: task.dueAt ?? null,
      source: task.source ?? null,
    };
  },
  fromFirestore(snapshot, options) {
    const data = snapshot.data(options) || {};
    return {
      text: typeof data.text === "string" ? data.text : "",
      completed: !!data.completed,
      createdAt: tsToDate(data.createdAt),
      remindAt: tsToDate(data.remindAt),
      dueAt: tsToDate(data.dueAt),
      source: typeof data.source === "string" ? data.source : undefined,
    };
  },
};

export const attemptRecordConverter: FirestoreDataConverter<AttemptRecord> = {
  toFirestore(a: AttemptRecord) {
    return {
      templateId: a.templateId,
      startedAt: serverTimestamp(),
      submittedAt: serverTimestamp(),
      completedAt: serverTimestamp(),
      payload: a.payload || {},
      pointsAwarded: a.pointsAwarded ?? 0,
    };
  },
  fromFirestore(snapshot, options) {
    const data = snapshot.data(options) || {};
    return {
      templateId: String(data.templateId || ""),
      startedAt: tsToDate(data.startedAt),
      submittedAt: tsToDate(data.submittedAt),
      completedAt: tsToDate(data.completedAt),
      payload: typeof data.payload === "object" && data.payload ? data.payload : {},
      pointsAwarded: typeof data.pointsAwarded === "number" ? data.pointsAwarded : 0,
    };
  },
};
