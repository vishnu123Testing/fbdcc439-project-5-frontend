import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SearchFilters, SearchFiltersProps } from '../../../src/components/knowledge/SearchFilters';
import { ArticleSearchParams, Category, Tag } from '../../../src/services/knowledge';

describe('SearchFilters Component', () => {
  const mockCategories: Category[] = [
    { id: 'cat-1', name: 'Engineering', description: 'Engineering guides', created_at: '2026-01-01' },
    { id: 'cat-2', name: 'Customer Support', description: 'Support playbooks', created_at: '2026-01-01' },
  ];

  const mockTags: Tag[] = [
    { id: 'tag-1', name: 'Onboarding', created_at: '2026-01-01' },
    { id: 'tag-2', name: 'Billing', created_at: '2026-01-01' },
  ];

  const defaultProps: SearchFiltersProps = {
    searchParams: {
      query: '',
      content_type: undefined,
      category_id: undefined,
      tag_ids: undefined,
      page: 1,
    },
    categories: mockCategories,
    tags: mockTags,
    onSearchChange: vi.fn(),
    onResetFilters: vi.fn(),
    totalResults: 15,
  };

  it('renders search input, content type pills, categories dropdown, tag pills, and total results counter', () => {
    render(<SearchFilters {...defaultProps} />);

    expect(screen.getByTestId('search-filters')).toBeInDocument();
    expect(screen.getByTestId('search-input')).toBeInDocument();
    expect(screen.getByTestId('content-type-filter')).toBeInDocument();
    expect(screen.getByTestId('category-filter')).toBeInDocument();
    expect(screen.getByTestId('tag-filter')).toBeInDocument();
    expect(screen.getByTestId('results-count')).toHaveTextContent('15 resources found');
  });

  it('triggers onSearchChange when user types into full-text search input with sanitized text', () => {
    const onSearchChange = vi.fn();
    render(<SearchFilters {...defaultProps} onSearchChange={onSearchChange} />);

    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: '<script>alert("xss")</script>Onboarding' } });

    expect(onSearchChange).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'Onboarding',
        page: 1,
      })
    );
  });

  it('triggers onSearchChange with content_type filter when user clicks a content type tab', () => {
    const onSearchChange = vi.fn();
    render(<SearchFilters {...defaultProps} onSearchChange={onSearchChange} />);

    const playbookPill = screen.getByTestId('content-type-Playbook');
    fireEvent.click(playbookPill);

    expect(onSearchChange).toHaveBeenCalledWith(
      expect.objectContaining({
        content_type: 'Playbook',
        page: 1,
      })
    );
  });

  it('triggers onSearchChange when selecting a category from the dropdown', () => {
    const onSearchChange = vi.fn();
    render(<SearchFilters {...defaultProps} onSearchChange={onSearchChange} />);

    const categorySelect = screen.getByTestId('category-filter');
    fireEvent.change(categorySelect, { target: { value: 'cat-2' } });

    expect(onSearchChange).toHaveBeenCalledWith(
      expect.objectContaining({
        category_id: 'cat-2',
        page: 1,
      })
    );
  });

  it('toggles tag inclusion when user clicks a tag pill', () => {
    const onSearchChange = vi.fn();
    render(<SearchFilters {...defaultProps} onSearchChange={onSearchChange} />);

    const tagPill = screen.getByTestId('tag-pill-tag-1');
    fireEvent.click(tagPill);

    expect(onSearchChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tag_ids: ['tag-1'],
        page: 1,
      })
    );
  });

  it('renders clear search button when search query is non-empty and clears input when clicked', () => {
    const onSearchChange = vi.fn();
    const propsWithQuery: SearchFiltersProps = {
      ...defaultProps,
      searchParams: { ...defaultProps.searchParams, query: 'Existing' },
      onSearchChange,
    };

    render(<SearchFilters {...propsWithQuery} />);

    const clearBtn = screen.getByTestId('clear-search-btn');
    expect(clearBtn).toBeInDocument();

    fireEvent.click(clearBtn);

    expect(onSearchChange).toHaveBeenCalledWith(
      expect.objectContaining({
        query: '',
        page: 1,
      })
    );
  });

  it('renders active filter indicators and calls onResetFilters when Reset Filters button is clicked', () => {
    const onResetFilters = vi.fn();
    const activeProps: SearchFiltersProps = {
      ...defaultProps,
      searchParams: {
        query: 'billing',
        content_type: 'FAQ',
        category_id: 'cat-1',
        tag_ids: ['tag-1'],
        page: 1,
      },
      onResetFilters,
    };

    render(<SearchFilters {...activeProps} />);

    const resetBtn = screen.getByTestId('reset-filters-btn');
    expect(resetBtn).toBeInDocument();

    fireEvent.click(resetBtn);
    expect(onResetFilters).toHaveBeenCalledTimes(1);
  });
});
