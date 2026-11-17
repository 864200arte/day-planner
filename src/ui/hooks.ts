import { useMemo } from 'react';
import { useApp } from '../lib/store';
import type { Category } from '../lib/types';
import { t } from '../lib/i18n';

export const useCats = () => {
  const { categories } = useApp();
  return useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c]));
    return { list: categories, get: (id: string): Category => map.get(id) ?? categories[categories.length - 1] ?? { id, name: '—', color: '#94a3b8', updatedAt: 0 } };
  }, [categories]);
};

export const catLabel = (c: Category) => (c.builtin ? t(c.name) : c.name);

export const PRIORITIES = [
  { v: 0, label: 'Без пріоритету', short: '—', color: '#94a3b8' },
  { v: 1, label: 'Низький', short: '!', color: '#38bdf8' },
  { v: 2, label: 'Середній', short: '!!', color: '#f59e0b' },
  { v: 3, label: 'Високий', short: '!!!', color: '#f43f5e' },
] as const;
