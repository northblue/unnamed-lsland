// Keep a recommendation stable while the pointer travels between the scene and UI.
export function createBuildSelection() {
  let pinned = null;
  let current = null;
  return {
    recommend(position) { pinned = position; current = position; },
    beginManual() { pinned = null; },
    update(candidate) {
      current = pinned ?? candidate ?? current;
      return current;
    },
    reset() { pinned = null; current = null; },
    get position() { return current; },
  };
}
