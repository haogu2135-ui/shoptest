import { fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider } from '../i18n';
import { SearchBar } from './SearchBar';

const renderSearchBar = (onSearch: jest.Mock, debounceMs = 300) => render(
  <LanguageProvider>
    <SearchBar onSearch={onSearch} debounceMs={debounceMs} />
  </LanguageProvider>,
);

describe('SearchBar', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.localStorage.setItem('shop-language', 'en');
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    window.localStorage.clear();
  });

  it('does not fire an empty search on initial mount', () => {
    const onSearch = jest.fn();
    renderSearchBar(onSearch);

    jest.advanceTimersByTime(300);

    expect(onSearch).not.toHaveBeenCalled();
  });

  it('debounces user-entered search text', () => {
    const onSearch = jest.fn();
    renderSearchBar(onSearch, 200);

    fireEvent.change(screen.getByPlaceholderText('Search products'), {
      target: { value: 'cat tree' },
    });
    jest.advanceTimersByTime(199);

    expect(onSearch).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);

    expect(onSearch).toHaveBeenCalledWith('cat tree');
  });
});
