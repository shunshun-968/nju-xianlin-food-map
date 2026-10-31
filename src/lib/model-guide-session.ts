export type ModelGuideKind = 'mouse' | 'touch';

// sessionStorage survives refresh/navigation in this tab, but not a fresh tab session.
// Memory is a fallback for browsers that disable storage.
const dismissed = new Set<ModelGuideKind>();
const key = (kind: ModelGuideKind) => `foodmap:model-guide:v1:${kind}`;
export function hasSeenModelGuide(kind: ModelGuideKind) {
  if (dismissed.has(kind)) return true;
  try {
    return sessionStorage.getItem(key(kind)) === 'seen';
  } catch {
    return false;
  }
}
export function dismissModelGuide(kind: ModelGuideKind) {
  dismissed.add(kind);
  try {
    sessionStorage.setItem(key(kind), 'seen');
  } catch {
    // The current page still remembers dismissal when storage is unavailable.
  }
}
