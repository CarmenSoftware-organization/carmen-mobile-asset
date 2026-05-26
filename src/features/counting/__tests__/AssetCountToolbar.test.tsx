import { render, screen, fireEvent } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../platform/i18n';
import { AssetCountToolbar } from '../AssetCountToolbar';

function setup(over: Partial<React.ComponentProps<typeof AssetCountToolbar>> = {}) {
  const props = {
    search: '',
    onSearchChange: jest.fn(),
    sort: 'code' as const,
    onSortChange: jest.fn(),
    category: null as string | null,
    onCategoryChange: jest.fn(),
    categories: ['IT Equipment'],
    ...over,
  };
  render(<AssetCountToolbar {...props} />);
  return props;
}

describe('AssetCountToolbar', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('reports typed search text', () => {
    const props = setup();
    fireEvent.changeText(screen.getByPlaceholderText('Search assets…'), 'desk');
    expect(props.onSearchChange).toHaveBeenCalledWith('desk');
  });

  it('reports a chosen sort key', () => {
    const props = setup();
    fireEvent.press(screen.getByText('Name'));
    expect(props.onSortChange).toHaveBeenCalledWith('name');
  });

  it('reports a chosen category and the All-categories reset', () => {
    const props = setup({ category: 'IT Equipment' });
    fireEvent.press(screen.getByText('All categories'));
    expect(props.onCategoryChange).toHaveBeenCalledWith(null);
    fireEvent.press(screen.getByText('IT Equipment'));
    expect(props.onCategoryChange).toHaveBeenCalledWith('IT Equipment');
  });
});
