/**
 * fileRegistry.ts
 * Module-level store for video File objects, keyed by projectId.
 * Survives React Router navigations without serialization limitations.
 */

const registry = new Map<string, File[]>();

export function registerFiles(projectId: string, files: File[]): void {
  registry.set(projectId, files);
}

export function getFiles(projectId: string): File[] | null {
  return registry.get(projectId) ?? null;
}

export function addFilesToProject(projectId: string, incoming: File[]): void {
  const existing = registry.get(projectId) ?? [];
  registry.set(projectId, [...existing, ...incoming]);
}

export function clearFiles(projectId: string): void {
  registry.delete(projectId);
}
