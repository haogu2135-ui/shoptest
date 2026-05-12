export const createLocalId = (existingIds: Iterable<number> = []) => {
  const usedIds = new Set(existingIds);
  let id = -Date.now();

  while (usedIds.has(id)) {
    id -= 1;
  }

  return id;
};
