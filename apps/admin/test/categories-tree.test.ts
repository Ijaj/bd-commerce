import { describe, expect, it } from 'vitest';
import {
  buildTree,
  categoryLabel,
  deleteMoveTargets,
  eligibleMoveTargets,
  flattenTree,
  reorderSiblings,
  subtreeHeight,
  type TreeCategory,
} from '~/features/categories/tree';

function cat(id: string, parent: TreeCategory | null, sort = 0, nameEn = id): TreeCategory {
  return {
    id,
    parentId: parent?.id ?? null,
    level: (parent?.level ?? 0) + 1,
    path: `${parent?.path ?? '/'}${id}/`,
    sort,
    nameEn,
  };
}

// men(1) > shirts(2) > polo(3) > slim(4); men > shoes(2); women(1) > dresses(2)
const men = cat('men', null, 0);
const women = cat('women', null, 1);
const shirts = cat('shirts', men, 1);
const shoes = cat('shoes', men, 0);
const polo = cat('polo', shirts);
const slim = cat('slim', polo);
const dresses = cat('dresses', women);
const flat = [slim, dresses, women, polo, shirts, men, shoes];

describe('buildTree', () => {
  it('nests by parentId and sorts siblings by sort then name', () => {
    const tree = buildTree(flat);
    expect(tree.map((n) => n.category.id)).toEqual(['men', 'women']);
    expect(tree[0]?.children.map((n) => n.category.id)).toEqual(['shoes', 'shirts']);
    expect(flattenTree(tree).map((c) => c.id)).toEqual([
      'men',
      'shoes',
      'shirts',
      'polo',
      'slim',
      'women',
      'dresses',
    ]);
  });

  it('breaks ties by name and keeps orphans as roots', () => {
    const a = cat('a', null, 0, 'Banana');
    const b = cat('b', null, 0, 'Apple');
    const orphan = { ...cat('o', null, 5), parentId: 'missing' };
    expect(buildTree([a, b, orphan]).map((n) => n.category.id)).toEqual(['b', 'a', 'o']);
  });
});

describe('subtreeHeight', () => {
  it('counts levels below', () => {
    expect(subtreeHeight(flat, men)).toBe(3);
    expect(subtreeHeight(flat, shirts)).toBe(2);
    expect(subtreeHeight(flat, slim)).toBe(0);
  });
});

describe('eligibleMoveTargets', () => {
  it('excludes self, descendants and current parent', () => {
    const ids = eligibleMoveTargets(flat, shirts, 9).targets.map((t) => t.id);
    expect(ids).not.toContain('shirts');
    expect(ids).not.toContain('polo');
    expect(ids).not.toContain('slim');
    expect(ids).not.toContain('men');
    expect(ids).toEqual(expect.arrayContaining(['women', 'dresses', 'shoes']));
  });

  it('respects the depth limit using the sub-tree height', () => {
    // shirts has height 2 -> new parent must be level <= 1
    const ids = eligibleMoveTargets(flat, shirts).targets.map((t) => t.id);
    expect(ids).toEqual(['women']);
    expect(ids).not.toContain('dresses');
    // a leaf can sit under level 3 but not under level 4
    const leaf = eligibleMoveTargets(flat, shoes).targets.map((t) => t.id);
    expect(leaf).toContain('polo');
    expect(leaf).not.toContain('slim');
  });

  it('allows main level only when it is not already a root and it fits', () => {
    expect(eligibleMoveTargets(flat, men).root).toBe(false);
    expect(eligibleMoveTargets(flat, shirts).root).toBe(true);
    // with a 2-level cap a 3-level sub-tree cannot become a main category
    expect(eligibleMoveTargets(flat, shirts, 2).root).toBe(false);
  });
});

describe('deleteMoveTargets', () => {
  it('excludes the sub-tree and any target that cannot hold the children', () => {
    // shirts has children (height 2): target level + 2 <= 4
    const ids = deleteMoveTargets(flat, shirts).map((t) => t.id);
    expect(ids).toEqual(['men', 'shoes', 'women', 'dresses']);
  });

  it('is unrestricted for a leaf (only products move)', () => {
    const ids = deleteMoveTargets(flat, slim).map((t) => t.id);
    expect(ids).toContain('polo');
    expect(ids).not.toContain('slim');
  });
});

describe('helpers', () => {
  it('categoryLabel joins ancestors', () => {
    expect(categoryLabel(flat, polo)).toBe('men > shirts > polo');
  });

  it('reorderSiblings renumbers all siblings', () => {
    expect(reorderSiblings(['a', 'b', 'c'], 'c', 'a')).toEqual([
      { id: 'c', sort: 0 },
      { id: 'a', sort: 1 },
      { id: 'b', sort: 2 },
    ]);
    expect(reorderSiblings(['a', 'b'], 'a', 'a')).toBeNull();
    expect(reorderSiblings(['a', 'b'], 'a', 'zzz')).toBeNull();
  });
});
