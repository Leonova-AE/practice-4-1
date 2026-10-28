
import type { Book } from './task1-types';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchBooks(): Promise<Book[]> {
  await delay(800);

  if (Math.random() < 0.2) {
    throw new Error('Сбой сети. Не удалось загрузить книги.');
  }

  const stored = localStorage.getItem('catalog');

  if (!stored) return [];

  const parsed: unknown = JSON.parse(stored);

  // Совместимость с форматом из практики 3.1
  if (Array.isArray(parsed)) return parsed as Book[];

  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'books' in parsed &&
    Array.isArray(parsed.books)
  ) {
    return parsed.books as Book[];
  }

  return [];
}

export async function saveBooks(books: Book[]): Promise<void> {
  await delay(500);
  localStorage.setItem('catalog', JSON.stringify(books));
}
