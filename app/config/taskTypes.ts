import { TaskType } from '../types/models.js';

export interface ImportablePreset {
  name: string;
  types: TaskType[];
}

export const importableTypes: ImportablePreset[] = [
  {
    name: 'Collège',
    types: [
      { name: 'Mathématiques', color: '#ef4444' },
      { name: 'Français',      color: '#3b82f6' },
      { name: 'Histoire',      color: '#f59e0b' },
      { name: 'Anglais',       color: '#fde047' },
      { name: 'Espagnol',      color: '#22c55e' },
      { name: 'Allemand',      color: '#22c55e' },
      { name: 'Physique',      color: '#9ca3af' },
      { name: 'SVT',           color: '#166534' },
      { name: 'EPS',           color: '#8b5cf6' },
      { name: 'Musique',       color: '#ec4899' },
      { name: 'Arts plastiques', color: '#ec4899' },
    ],
  },
  {
    name: 'Lycée',
    types: [
      { name: 'Mathématiques', color: '#ef4444' },
      { name: 'Français',      color: '#3b82f6' },
      { name: 'Philosophie',   color: '#10b981' },
      { name: 'Histoire',      color: '#f59e0b' },
      { name: 'Anglais',       color: '#fde047' },
      { name: 'Espagnol',      color: '#22c55e' },
      { name: 'Allemand',      color: '#22c55e' },
      { name: 'Physique',      color: '#9ca3af' },
      { name: 'SVT',           color: '#166534' },
      { name: 'Autre',         color: '#8b5cf6' },
    ],
  },
  {
    name: 'Travail',
    types: [
      { name: 'Réunions',       color: '#3b82f6' },
      { name: 'Projets',        color: '#ef4444' },
      { name: 'Documentation',  color: '#10b981' },
      { name: 'E-mails',        color: '#fde047' },
      { name: 'Formation',      color: '#8b5cf6' },
      { name: 'Administration', color: '#06b6d4' },
    ],
  },
];

/** Mutable runtime array of active task types (loaded from localStorage or preset). */
export const taskTypes: TaskType[] = (() => {
  const obj = importableTypes.find(x => x.name === 'Lycée');
  return obj ? [...obj.types] : [{ name: '(default)', color: '#6b7280' }];
})();
