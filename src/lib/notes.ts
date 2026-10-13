import AsyncStorage from '@react-native-async-storage/async-storage';

/** Notes dictées, gardées sur le téléphone uniquement. */

export type Note = { id: string; text: string; createdAt: string };

const KEY = 'notes';

export async function loadNotes(): Promise<Note[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Note[]) : [];
  } catch {
    return [];
  }
}

async function save(notes: Note[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(notes));
}

export async function addNote(text: string): Promise<Note[]> {
  const notes = await loadNotes();
  const next = [{ id: String(Date.now()), text, createdAt: new Date().toISOString() }, ...notes];
  await save(next);
  return next;
}

export async function deleteNote(id: string): Promise<Note[]> {
  const next = (await loadNotes()).filter((n) => n.id !== id);
  await save(next);
  return next;
}

export async function clearNotes(): Promise<Note[]> {
  await save([]);
  return [];
}
