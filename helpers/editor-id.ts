// Generates a stable, client-only id for editor list rows — see
// types/knowledge-editor.ts for why. Never persisted.
export function newEditorId(): string {
  return crypto.randomUUID();
}
