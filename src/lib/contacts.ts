import * as Contacts from 'expo-contacts';

import { normalize } from './text';

export type FoundContact = { name: string; phone: string };

export type ContactLookup =
  | { ok: true; contact: FoundContact }
  | { ok: false; reason: 'permission' | 'notFound' | 'noPhone' };

/** Un numéro dicté directement : « appelle le 06 12 34 56 78 ». */
function asPhoneNumber(spoken: string): string | null {
  const digits = spoken.replace(/[^\d+]/g, '');
  return digits.replace(/\D/g, '').length >= 6 ? digits : null;
}

/**
 * Cherche un contact par le nom prononcé. Les noms se comparent sans accents
 * ni majuscules : la reconnaissance vocale écrit « helene » ou « Hélène » au
 * hasard.
 */
export async function findContact(spoken: string): Promise<ContactLookup> {
  const number = asPhoneNumber(spoken);
  if (number) return { ok: true, contact: { name: number, phone: number } };

  const { granted } = await Contacts.requestPermissionsAsync();
  if (!granted) return { ok: false, reason: 'permission' };

  const wanted = normalize(spoken).replace(/^(?:a|le|la|mon|ma|chez)\s+/, '');
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
  });

  const scored = data
    .map((c) => {
      const name = normalize(c.name ?? '');
      const score =
        name === wanted ? 3 : name.startsWith(`${wanted} `) ? 2 : ` ${name} `.includes(` ${wanted} `) ? 1 : 0;
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { ok: false, reason: 'notFound' };
  const best = scored[0].c;
  const phones = best.phoneNumbers ?? [];
  // On préfère le portable : c'est le seul qui reçoit les SMS.
  const phone = phones.find((p) => /mobile|portable|cell/i.test(p.label ?? '')) ?? phones[0];
  if (!phone?.number) return { ok: false, reason: 'noPhone' };
  return { ok: true, contact: { name: best.name ?? spoken, phone: phone.number.replace(/\s/g, '') } };
}
