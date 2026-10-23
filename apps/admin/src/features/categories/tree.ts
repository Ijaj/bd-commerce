export const MAX_LEVEL = 4;

/** The bits of a category the tree helpers need. */
export interface TreeCategory {
  id: string;
  parentId: string | null;
  level: number;
  path: string;
  sort: number;
  nameEn: string;
}

export interface TreeNode<T extends TreeCategory> {
  category: T;
  children: TreeNode<T>[];
}

const bySort = (a: TreeCategory, b: TreeCategory) =>
  a.sort - b.sort || a.nameEn.localeCompare(b.nameEn) || a.id.localeCompare(b.id);

/** Flat list -> nested tree; siblings by sort, then name. Categories whose parent is missing become roots. */
export function buildTree<T extends TreeCategory>(flat: T[]): TreeNode<T>[] {
  const nodes = new Map<string, TreeNode<T>>(
    flat.map((c) => [c.id, { category: c, children: [] }]),
  );
  const roots: TreeNode<T>[] = [];
  for (const node of nodes.values()) {
    const parent = node.category.parentId ? nodes.get(node.category.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  const sortRec = (list: TreeNode<T>[]) => {
    list.sort((a, b) => bySort(a.category, b.category));
    for (const n of list) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

/** Depth-first (display) order of a tree. */
export function flattenTree<T extends TreeCategory>(nodes: TreeNode<T>[]): T[] {
  return nodes.flatMap((n) => [n.category, ...flattenTree(n.children)]);
}

export function descendantIds(flat: TreeCategory[], cat: TreeCategory): Set<string> {
  return new Set(
    flat.filter((c) => c.id !== cat.id && c.path.startsWith(cat.path)).map((c) => c.id),
  );
}

/** How many levels sit below this category (0 for a leaf). */
export function subtreeHeight(flat: TreeCategory[], cat: TreeCategory): number {
  let max = cat.level;
  for (const c of flat) if (c.path.startsWith(cat.path) && c.level > max) max = c.level;
  return max - cat.level;
}

export interface MoveTargets<T extends TreeCategory> {
  /** May the category become a main (level 1) category? */
  root: boolean;
  /** Categories it can be put under, in display order. */
  targets: T[];
}

/**
 * Where can `cat` (with its sub-tree) be moved? Excludes itself, its descendants, its current
 * parent (no-op) and any parent that would push the deepest descendant below `maxLevel`.
 */
export function eligibleMoveTargets<T extends TreeCategory>(
  flat: T[],
  cat: TreeCategory,
  maxLevel = MAX_LEVEL,
): MoveTargets<T> {
  const height = subtreeHeight(flat, cat);
  const targets = sortDisplay(flat).filter(
    (c) =>
      c.id !== cat.id &&
      !c.path.startsWith(cat.path) &&
      c.id !== cat.parentId &&
      c.level + 1 + height <= maxLevel,
  );
  return { root: cat.parentId !== null && 1 + height <= maxLevel, targets };
}

/**
 * Targets for "move everything to another category" on delete: the products go anywhere outside
 * the sub-tree; the sub-categories (if any) must still fit the depth limit under the target.
 */
export function deleteMoveTargets<T extends TreeCategory>(
  flat: T[],
  cat: TreeCategory,
  maxLevel = MAX_LEVEL,
): T[] {
  const height = subtreeHeight(flat, cat);
  return sortDisplay(flat).filter(
    (c) => !c.path.startsWith(cat.path) && (height === 0 || c.level + height <= maxLevel),
  );
}

/** Display order without relying on the input being sorted. */
export function sortDisplay<T extends TreeCategory>(flat: T[]): T[] {
  return flattenTree(buildTree(flat));
}

/** "Men > Shirts > Polo" built from the path ids. */
export function categoryLabel(flat: TreeCategory[], cat: TreeCategory): string {
  const byId = new Map(flat.map((c) => [c.id, c]));
  return cat.path
    .split('/')
    .filter(Boolean)
    .map((id) => byId.get(id)?.nameEn ?? '?')
    .join(' > ');
}

/** Move `activeId` to the position of `overId` and return {id, sort} for every sibling. */
export function reorderSiblings(
  siblingIds: string[],
  activeId: string,
  overId: string,
): { id: string; sort: number }[] | null {
  const from = siblingIds.indexOf(activeId);
  const to = siblingIds.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return null;
  const next = [...siblingIds];
  next.splice(to, 0, ...next.splice(from, 1));
  return next.map((id, sort) => ({ id, sort }));
}
