export type RuntimeDataBackend = 'sqlite' | 'firestore';

export function resolveRuntimeDataBackend(
  rawValue: string | undefined = process.env.MV_DATA_BACKEND
): RuntimeDataBackend {
  const normalized = String(rawValue || 'sqlite').trim().toLowerCase();
  if (normalized === 'sqlite' || normalized === 'firestore') {
    return normalized;
  }
  throw new Error(
    `Unsupported MV_DATA_BACKEND='${normalized}'. Expected 'sqlite' or 'firestore'.`
  );
}

export function isFirestoreRuntime(): boolean {
  return resolveRuntimeDataBackend() === 'firestore';
}
