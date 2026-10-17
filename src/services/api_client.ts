/**
 * Frontend API client wrapper for managing authentication, token storage,
 * and request execution against the backend API [FR-1, FR-2, FR-3, NFR-2, NFR-3].
 *
 * This module exports the core request utility and authentication endpoints,
 * as well as re-exporting symbols for snake_case/camelCase module import compatibility.
 */

export * from './apiClient';
export { default } from './apiClient';
