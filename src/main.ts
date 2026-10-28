
import './styles.css';
import type { Book } from './task1-types';
import { applyFilters, filterByAuthor, filterByMinYear } from './task3-filters';
import { createBookFromForm } from './task4-integration';
import { filterByTitle, sortBooks } from './task5-utils';
import { BookCatalog } from './task6-classes';
import { Wishlist } from './task7-wishlist';
import { fetchBooks, saveBooks } from './mock-api';

// ============================================================
// СОСТОЯНИЕ ПРИЛОЖЕНИЯ
// ============================================================

type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string };

let state: AsyncState<Book[]> = { status: 'idle' };

let catalog = new BookCatalog('main', []);
let wishlist = new Wishlist();

let saveErrorMessage = '';
let saving = false;
let errorTimer: ReturnType<typeof setTimeout> | undefined;

try {
  const savedWishlist = localStorage.getItem('wishlist');
  if (savedWishlist) {
    wishlist = new Wishlist(JSON.parse(savedWishlist));
  }
} catch (error) {
  console.error('Ошибка загрузки избранного:', error);
}

function saveWishlist(): void {
  localStorage.setItem(
    'wishlist',
    JSON.stringify(wishlist.getFavoriteIds())
  );
}

// ============================================================
// DOM-ЭЛЕМЕНТЫ
// ============================================================

const bookList = document.querySelector<HTMLDivElement>('#bookList')!;
const wishlistContainer = document.querySelector<HTMLDivElement>('#wishlistContainer')!;
const form = document.querySelector<HTMLFormElement>('#bookForm')!;
const filterBtn = document.querySelector<HTMLButtonElement>('#applyFilters')!;
const authorInput = document.querySelector<HTMLInputElement>('#filterAuthor')!;
const yearInput = document.querySelector<HTMLInputElement>('#filterYear')!;
const formErrorElement = document.querySelector<HTMLDivElement>('#errorMessage')!;
const searchInput = document.querySelector<HTMLInputElement>('#searchInput')!;
const sortBySelect = document.querySelector<HTMLSelectElement>('#sortBy')!;

// ============================================================
// ОТОБРАЖЕНИЕ ОШИБОК СОХРАНЕНИЯ
// ============================================================

function showSaveError(message: string): void {
  saveErrorMessage = message;

  if (errorTimer !== undefined) {
    clearTimeout(errorTimer);
  }

  render();

  errorTimer = setTimeout(() => {
    saveErrorMessage = '';
    render();
  }, 3000);
}

// ============================================================
// АСИНХРОННОЕ СОХРАНЕНИЕ
// ============================================================

async function persistBooks(newBooks: Book[]): Promise<boolean> {
  if (saving || state.status !== 'success') return false;

  saving = true;

  try {
    await saveBooks(newBooks);

    catalog = new BookCatalog('main', newBooks);
    state = { status: 'success', data: newBooks };

    render();
    return true;
  } catch (error) {
    showSaveError(
      error instanceof Error ? error.message : 'Не удалось сохранить книги'
    );
    return false;
  } finally {
    saving = false;
  }
}

// ============================================================
// КАРТОЧКА КНИГИ
// ============================================================

function createBookCard(book: Book): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'book-card';

  const titleEl = document.createElement('h3');
  titleEl.textContent =
    `${book.title} — ${book.authors.join(', ')}${book.year ? `, ${book.year}` : ''}`;

  card.append(titleEl);

  if (book.rating !== undefined) {
    const ratingEl = document.createElement('p');
    ratingEl.textContent = `Рейтинг: ${book.rating}`;
    card.append(ratingEl);
  }

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Удалить';
  deleteBtn.disabled = saving;

  deleteBtn.addEventListener('click', async () => {
    if (state.status !== 'success' || saving) return;

    const newBooks = state.data.filter(item => item.id !== book.id);

    await persistBooks(newBooks);
  });

  card.append(deleteBtn);

  const favBtn = document.createElement('button');
  favBtn.textContent = wishlist.has(book.id)
    ? '❤️ В избранном'
    : '🤍 В избранное';

  favBtn.addEventListener('click', () => {
    wishlist.toggle(book.id);
    saveWishlist();
    render();
  });

  card.append(favBtn);

  return card;
}

// ============================================================
// ОТРИСОВКА СПИСКА
// ============================================================

function renderBooks(books: Book[]): void {
  bookList.innerHTML = '';

  if (books.length === 0) {
    bookList.textContent = 'Книги не найдены. Попробуйте изменить фильтры.';
    return;
  }

  books.forEach(book => {
    bookList.append(createBookCard(book));
  });
}

function renderWishlist(): void {
  wishlistContainer.innerHTML = '';

  const favBooks = wishlist.getFavorites(catalog);

  if (favBooks.length === 0) {
    wishlistContainer.textContent = 'Пока ничего не добавлено';
    return;
  }

  favBooks.forEach(book => {
    wishlistContainer.append(createBookCard(book));
  });
}

// ============================================================
// ФИЛЬТРАЦИЯ И СОРТИРОВКА
// ============================================================

function updateView(books: Book[]): void {
  const filters: ((book: Book) => boolean)[] = [];

  if (authorInput.value.trim()) {
    filters.push(filterByAuthor(authorInput.value.trim()));
  }

  if (yearInput.value) {
    filters.push(filterByMinYear(parseInt(yearInput.value, 10)));
  }

  if (searchInput.value.trim()) {
    filters.push(filterByTitle(searchInput.value.trim()));
  }

  const filtered = applyFilters(books, filters);
  const sorted = sortBooks(
    filtered,
    sortBySelect.value as 'year' | 'rating'
  );

  renderBooks(sorted);
  renderWishlist();
}

// ============================================================
// ПАТТЕРН ASYNCSTATE И ГЛАВНАЯ ФУНКЦИЯ RENDER
// ============================================================

function render(): void {
  formErrorElement.textContent = saveErrorMessage;

  switch (state.status) {
    case 'idle':
      bookList.textContent = 'Подготовка приложения...';
      wishlistContainer.innerHTML = '';
      break;

    case 'loading':
      bookList.textContent = '⏳ Загрузка данных...';
      wishlistContainer.innerHTML = '';
      break;

    case 'success':
      updateView(state.data);
      break;

    case 'error': {
      bookList.innerHTML = '';
      wishlistContainer.innerHTML = '';

      const errorBlock = document.createElement('div');
      errorBlock.style.color = '#dc2626';

      const message = document.createElement('p');
      message.textContent = state.message;

      const retryBtn = document.createElement('button');
      retryBtn.textContent = 'Повторить попытку';
      retryBtn.addEventListener('click', () => {
        void initApp();
      });

      errorBlock.append(message, retryBtn);
      bookList.append(errorBlock);
      break;
    }
  }
}

// ============================================================
// АСИНХРОННАЯ ИНИЦИАЛИЗАЦИЯ
// ============================================================

async function initApp(): Promise<void> {
  state = { status: 'loading' };
  render();

  try {
    const books = await fetchBooks();

    catalog = new BookCatalog('main', books);
    state = { status: 'success', data: books };
  } catch (error) {
    state = {
      status: 'error',
      message: error instanceof Error
        ? error.message
        : 'Неизвестная ошибка'
    };
  }

  render();
}

// ============================================================
// АСИНХРОННОЕ ДОБАВЛЕНИЕ КНИГИ
// ============================================================

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (state.status !== 'success' || saving) return;

  saveErrorMessage = '';

  try {
    const formData = new FormData(form);
    const newBook = createBookFromForm(formData);

    const newBooks = [...state.data, newBook];

    const saved = await persistBooks(newBooks);

    if (saved) {
      form.reset();
      render();
    }
  } catch (error) {
    showSaveError(
      error instanceof Error ? error.message : 'Ошибка добавления книги'
    );
  }
});

// ============================================================
// ФИЛЬТРЫ И ПОИСК
// ============================================================

filterBtn.addEventListener('click', render);
searchInput.addEventListener('input', render);
sortBySelect.addEventListener('change', render);

// ============================================================
// ЗАПУСК
// ============================================================

void initApp();
