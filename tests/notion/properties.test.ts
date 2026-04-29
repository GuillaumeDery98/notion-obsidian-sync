import { describe, it, expect } from 'vitest';
import { extractNotionProperties, extractType } from '../../src/notion/properties.js';

describe('extractNotionProperties', () => {
  it('extracts tache properties', () => {
    const props = {
      Nom: { type: 'title', title: [{ plain_text: 'Build API' }] },
      Status: { type: 'select', select: { name: 'En cours' } },
    };
    const result = extractNotionProperties(props, 'taches');
    expect(result.notion_id).toBeUndefined();
    expect(result.status).toBe('En cours');
  });

  it('extracts ressource properties', () => {
    const props = {
      Nom: { type: 'title', title: [{ plain_text: 'Atomic Habits' }] },
      Type: { type: 'select', select: { name: 'Book' } },
      URL: { type: 'url', url: 'https://example.com' },
      Tags: { type: 'multi_select', multi_select: [{ name: 'productivity' }, { name: 'habits' }] },
      Auteur: { type: 'rich_text', rich_text: [{ plain_text: 'James Clear' }] },
      'Fiction ?': { type: 'checkbox', checkbox: false },
      Rating: { type: 'rich_text', rich_text: [{ plain_text: '4/5' }] },
      Projets: { type: 'relation', relation: [{ id: 'proj-1' }] },
    };
    const pageIndex = new Map([['proj-1', 'SelfFeed']]);

    const result = extractNotionProperties(props, 'ressources', pageIndex);
    expect(result.type).toBe('Book');
    expect(result.url).toBe('https://example.com');
    expect(result.tags).toEqual(['productivity', 'habits']);
    expect(result.auteur).toBe('James Clear');
    expect(result.fiction).toBe(false);
    expect(result.rating).toBe('4/5');
    expect(result.projets).toEqual(['[[SelfFeed]]']);
  });

  it('extracts projet properties', () => {
    const props = {
      Nom: { type: 'title', title: [{ plain_text: 'SelfFeed' }] },
      Sélection: { type: 'select', select: { name: 'Doing' } },
      Deadline: { type: 'date', date: { start: '2024-09-01' } },
      Areas: { type: 'relation', relation: [{ id: 'area-1' }] },
    };
    const pageIndex = new Map([['area-1', 'Saas']]);

    const result = extractNotionProperties(props, 'projets', pageIndex);
    expect(result.selection).toBe('Doing');
    expect(result.deadline).toBe('2024-09-01');
    expect(result.areas).toEqual(['[[Saas]]']);
  });

  it('extracts area properties', () => {
    const props = {
      Nom: { type: 'title', title: [{ plain_text: 'Saas' }] },
      Date: { type: 'date', date: { start: '2024-08-02' } },
    };
    const result = extractNotionProperties(props, 'areas');
    expect(result.date).toBe('2024-08-02');
  });
});

describe('extractType', () => {
  it('extracts Type select from properties', () => {
    const props = {
      Type: { type: 'select', select: { name: 'Recette' } },
    };
    expect(extractType(props)).toBe('Recette');
  });

  it('returns undefined when no Type property', () => {
    expect(extractType({})).toBeUndefined();
  });
});
