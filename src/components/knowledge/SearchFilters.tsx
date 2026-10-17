'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Search, X, Filter, RotateCcw, Tag as TagIcon, Folder, BookOpen } from 'lucide-react';
import {
  ArticleSearchParams,
  ContentType,
  Category,
  Tag,
  sanitizeString,
} from '../../services/knowledge';

/**
 * Available content type options with human-readable labels [FR-1, FR-7].
 */
export const CONTENT_TYPE_OPTIONS: { value: ContentType | ''; label: string; description: string }[] = [
  { value: '', label: 'All Content Types', description: 'Show all knowledge resources' },
  { value: 'FAQ', label: 'FAQs', description: 'Frequently asked questions & answers' },
  { value: 'Playbook', label: 'Playbooks', description: 'Step-by-step operational process guides' },
  { value: 'BestPractice', label: 'Best Practices', description: 'Standard operating procedures & recommendations' },
  { value: 'TrainingVideo', label: 'Training Videos', description: 'On-demand video modules & tutorials' },
];

/**
 * Properties for the SearchFilters component [FR-1, FR-2, FR-7, FR-8].
 */
export interface SearchFiltersProps {
  /**
   * Current search query and filter parameters [FR-1, FR-2, FR-7].
   */
  searchParams: ArticleSearchParams;
  /**
   * List of available categories for filtering [FR-1, FR-7].
   */
  categories?: Category[];
  /**
   * List of available tags for filtering [FR-1, FR-7].
   */
  tags?: Tag[];
  /**
   * Callback fired when any search parameter or filter changes [FR-1, FR-2, FR-8].
   */
  onSearchChange: (newParams: ArticleSearchParams) => void;
  /**
   * Optional callback fired when resetting all search filters [FR-1, FR-2].
   */
  onResetFilters?: () => void;
  /**
   * Whether search or filter execution is currently loading [NFR-1].
   */
  isLoading?: boolean;
  /**
   * Total number of matching articles found for active filters [FR-1, FR-2].
   */
  totalResults?: number;
  /**
   * Additional CSS class names.
   */
  className?: string;
}

/**
 * Reusable Search and Filter UI Component for Knowledge Base Repository [FR-1, FR-2, FR-7, FR-8].
 *
 * Provides full-text search input, content-type tabs, category dropdowns, and multi-select tag pills
 * with input sanitization and responsive styling matching Linen & Logic design guidelines.
 */
export const SearchFilters: React.FC<SearchFiltersProps> = ({
  searchParams,
  categories = [],
  tags = [],
  onSearchChange,
  onResetFilters,
  isLoading = false,
  totalResults,
  className,
}) => {
  const [localQuery, setLocalQuery] = useState<string>(searchParams.query || '');

  // Keep local search input synchronized if searchParams.query changes externally
  useEffect(() => {
    setLocalQuery(searchParams.query || '');
  }, [searchParams.query]);

  // Handle search text change with sanitization [FR-8, NFR-3]
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setLocalQuery(rawVal);
    const sanitized = sanitizeString(rawVal);
    onSearchChange({
      ...searchParams,
      query: sanitized,
      page: 1,
    });
  };

  // Clear text search query
  const handleClearQuery = () => {
    setLocalQuery('');
    onSearchChange({
      ...searchParams,
      query: '',
      page: 1,
    });
  };

  // Handle content type pill selection [FR-7]
  const handleContentTypeChange = (selectedType: ContentType | '') => {
    onSearchChange({
      ...searchParams,
      content_type: selectedType || undefined,
      page: 1,
    });
  };

  // Handle category dropdown change [FR-7]
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const catId = e.target.value;
    onSearchChange({
      ...searchParams,
      category_id: catId || undefined,
      page: 1,
    });
  };

  // Get active tag IDs array
  const activeTagIds: string[] = React.useMemo(() => {
    if (!searchParams.tag_ids) return [];
    if (Array.isArray(searchParams.tag_ids)) return searchParams.tag_ids;
    return [searchParams.tag_ids];
  }, [searchParams.tag_ids]);

  // Toggle individual tag selection [FR-7]
  const handleTagToggle = (tagId: string) => {
    const exists = activeTagIds.includes(tagId);
    let updatedTagIds: string[];
    if (exists) {
      updatedTagIds = activeTagIds.filter((id) => id !== tagId);
    } else {
      updatedTagIds = [...activeTagIds, tagId];
    }
    onSearchChange({
      ...searchParams,
      tag_ids: updatedTagIds.length > 0 ? updatedTagIds : undefined,
      page: 1,
    });
  };

  // Check if any filter is currently active
  const hasActiveFilters = Boolean(
    (searchParams.query && searchParams.query.trim().length > 0) ||
      searchParams.content_type ||
      searchParams.category_id ||
      activeTagIds.length > 0
  );

  // Handle explicit reset of all filters
  const handleReset = useCallback(() => {
    setLocalQuery('');
    if (onResetFilters) {
      onResetFilters();
    } else {
      onSearchChange({
        query: '',
        content_type: undefined,
        category_id: undefined,
        tag_ids: undefined,
        page: 1,
      });
    }
  }, [onResetFilters, onSearchChange]);

  return (
    <div
      role="search"
      aria-label="Search and filter knowledge base"
      data-testid="search-filters"
      className={twMerge(
        'bg-[#fbf9f4] border border-[#d1c4b9] rounded-md p-5 space-y-5 shadow-sm text-[#1b1c19]',
        className
      )}
    >
      {/* Top Row: Full-text Search Bar & Total Counter */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#80756b]">
            <Search className="h-5 w-5" aria-hidden="true" />
          </div>
          <input
            type="text"
            data-testid="search-input"
            value={localQuery}
            onChange={handleQueryChange}
            placeholder="Search article titles, body content, tags, or categories..."
            aria-label="Search knowledge articles"
            className="w-full pl-10 pr-10 py-2.5 bg-[#ffffff] border border-[#d1c4b9] rounded-md text-sm text-[#1b1c19] placeholder-[#80756b] focus:outline-none focus:ring-2 focus:ring-[#735c41] focus:border-transparent transition-all"
          />
          {localQuery && (
            <button
              type="button"
              data-testid="clear-search-btn"
              onClick={handleClearQuery}
              aria-label="Clear search text"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#80756b] hover:text-[#1b1c19] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {totalResults !== undefined && (
          <div
            data-testid="results-count"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#eae8e3] rounded-md text-xs font-medium text-[#4e453d] whitespace-nowrap self-start md:self-auto"
          >
            <BookOpen className="h-4 w-4 text-[#735c41]" />
            <span>
              {totalResults} {totalResults === 1 ? 'resource' : 'resources'} found
            </span>
          </div>
        )}

        {hasActiveFilters && (
          <button
            type="button"
            data-testid="reset-filters-btn"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#f0eee9] hover:bg-[#eae8e3] text-[#735c41] border border-[#d1c4b9] rounded-md text-xs font-medium transition-colors whitespace-nowrap"
            aria-label="Reset all search filters"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Second Row: Content Type Tabs / Selector [FR-1, FR-7] */}
      <div className="space-y-2" data-testid="content-type-filter">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#4e453d] flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-[#735c41]" />
          <span>Content Type</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {CONTENT_TYPE_OPTIONS.map((opt) => {
            const isSelected =
              (!searchParams.content_type && opt.value === '') ||
              searchParams.content_type === opt.value;
            return (
              <button
                key={opt.value || 'all'}
                type="button"
                data-testid={`content-type-${opt.value || 'all'}`}
                onClick={() => handleContentTypeChange(opt.value)}
                aria-pressed={isSelected}
                className={clsx(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150',
                  isSelected
                    ? 'bg-[#735c41] text-[#ffffff] shadow-sm font-semibold'
                    : 'bg-[#f5f3ee] text-[#4e453d] hover:bg-[#eae8e3] border border-[#d1c4b9]'
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Third Row: Category Dropdown & Tag Selection [FR-1, FR-7] */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 border-t border-[#d1c4b9]">
        {/* Category Filter */}
        <div className="space-y-1.5">
          <label
            htmlFor="knowledge-category-select"
            className="text-xs font-semibold uppercase tracking-wider text-[#4e453d] flex items-center gap-1.5"
          >
            <Folder className="h-3.5 w-3.5 text-[#735c41]" />
            <span>Category</span>
          </label>
          <select
            id="knowledge-category-select"
            data-testid="category-filter"
            value={searchParams.category_id || ''}
            onChange={handleCategoryChange}
            aria-label="Filter by category"
            className="w-full px-3 py-2 bg-[#ffffff] border border-[#d1c4b9] rounded-md text-xs text-[#1b1c19] focus:outline-none focus:ring-2 focus:ring-[#735c41] focus:border-transparent transition-all"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tag Filters */}
        {tags.length > 0 && (
          <div className="space-y-1.5" data-testid="tag-filter">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#4e453d] flex items-center gap-1.5">
              <TagIcon className="h-3.5 w-3.5 text-[#735c41]" />
              <span>Tags</span>
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-[#f5f3ee] border border-[#d1c4b9] rounded-md">
              {tags.map((tag) => {
                const isSelected = activeTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    data-testid={`tag-pill-${tag.id}`}
                    onClick={() => handleTagToggle(tag.id)}
                    aria-pressed={isSelected}
                    className={clsx(
                      'px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1',
                      isSelected
                        ? 'bg-[#735c41] text-[#ffffff]'
                        : 'bg-[#ffffff] text-[#4e453d] hover:bg-[#eae8e3] border border-[#d1c4b9]'
                    )}
                  >
                    <span>#{tag.name}</span>
                    {isSelected && <X className="h-3 w-3 inline" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Active Filter Pills Bar */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#d1c4b9] text-xs text-[#4e453d]">
          <span className="font-semibold text-[#735c41]">Active Filters:</span>
          {searchParams.query && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#e4e2dd] rounded text-xs">
              Query: &quot;{searchParams.query}&quot;
              <button
                type="button"
                onClick={handleClearQuery}
                className="text-[#80756b] hover:text-[#1b1c19]"
                aria-label="Remove query filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {searchParams.content_type && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#e4e2dd] rounded text-xs">
              Type: {searchParams.content_type}
              <button
                type="button"
                onClick={() => handleContentTypeChange('')}
                className="text-[#80756b] hover:text-[#1b1c19]"
                aria-label="Remove content type filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {searchParams.category_id && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#e4e2dd] rounded text-xs">
              Category:{' '}
              {categories.find((c) => c.id === searchParams.category_id)?.name || searchParams.category_id}
              <button
                type="button"
                onClick={() =>
                  onSearchChange({
                    ...searchParams,
                    category_id: undefined,
                    page: 1,
                  })
                }
                className="text-[#80756b] hover:text-[#1b1c19]"
                aria-label="Remove category filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {activeTagIds.map((tid) => {
            const tagObj = tags.find((t) => t.id === tid);
            return (
              <span key={tid} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#e4e2dd] rounded text-xs">
                Tag: #{tagObj ? tagObj.name : tid}
                <button
                  type="button"
                  onClick={() => handleTagToggle(tid)}
                  className="text-[#80756b] hover:text-[#1b1c19]"
                  aria-label={`Remove tag ${tagObj ? tagObj.name : tid} filter`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SearchFilters;
