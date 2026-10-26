import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { nb } from '../i18n/nb';
import { translate } from '../i18n';

describe('i18n', () => {
  it('has an English text for every Norwegian key', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(nb).sort());
    for (const value of Object.values(en)) expect(value.trim()).not.toBe('');
  });

  it('keeps the same placeholders in both languages', () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(nb) as (keyof typeof nb)[]) expect(vars(en[key])).toEqual(vars(nb[key]));
  });

  it('interpolates variables', () => {
    expect(translate('nb', 'home.greeting', { name: 'Kari' })).toBe('Hei, Kari!');
    expect(translate('en', 'agenda.progress', { done: 2, total: 5 })).toBe('2 of 5 covered');
  });

  it('uses the required Norwegian navigation labels', () => {
    expect(['nav.home', 'nav.meetings', 'nav.calendar', 'nav.agenda', 'nav.participants'].map((k) => translate('nb', k as keyof typeof nb))).toEqual([
      'Hjem',
      'Møter',
      'Kalender',
      'Agenda',
      'Deltakere',
    ]);
    expect(translate('nb', 'home.openToday')).toBe('Åpne dagens møte');
  });
});
