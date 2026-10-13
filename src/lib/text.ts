/** "Hélène-Marie " → "helene marie" : pour comparer des noms dits à l'oral. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-_'’.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
