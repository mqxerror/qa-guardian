/**
 * Feature #129: URL State Hook
 * Store filters, pagination, and tabs in URL search params for shareable links
 *
 * Usage:
 * ```tsx
 * const [page, setPage] = useUrlState('page', '1');
 * const [filters, setFilters] = useUrlStateObject<{ status: string; project: string }>('filters', { status: 'all', project: 'all' });
 * ```
 */

import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

/**
 * Single value URL state
 * Stores a string value in URL search params
 */
export function useUrlState(
  key: string,
  defaultValue: string
): [string, (value: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const value = searchParams.get(key) || defaultValue;

  const setValue = useCallback(
    (newValue: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (newValue === defaultValue) {
          next.delete(key);
        } else {
          next.set(key, newValue);
        }
        return next;
      }, { replace: true });
    },
    [key, defaultValue, setSearchParams]
  );

  return [value, setValue];
}

/**
 * Number URL state
 * Stores a number value in URL search params
 */
export function useUrlStateNumber(
  key: string,
  defaultValue: number
): [number, (value: number) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const value = useMemo(() => {
    const param = searchParams.get(key);
    if (param === null) return defaultValue;
    const num = parseInt(param, 10);
    return isNaN(num) ? defaultValue : num;
  }, [searchParams, key, defaultValue]);

  const setValue = useCallback(
    (newValue: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (newValue === defaultValue) {
          next.delete(key);
        } else {
          next.set(key, String(newValue));
        }
        return next;
      }, { replace: true });
    },
    [key, defaultValue, setSearchParams]
  );

  return [value, setValue];
}

/**
 * Boolean URL state
 * Stores a boolean value in URL search params
 */
export function useUrlStateBoolean(
  key: string,
  defaultValue: boolean
): [boolean, (value: boolean) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const value = useMemo(() => {
    const param = searchParams.get(key);
    if (param === null) return defaultValue;
    return param === 'true' || param === '1';
  }, [searchParams, key, defaultValue]);

  const setValue = useCallback(
    (newValue: boolean) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (newValue === defaultValue) {
          next.delete(key);
        } else {
          next.set(key, newValue ? 'true' : 'false');
        }
        return next;
      }, { replace: true });
    },
    [key, defaultValue, setSearchParams]
  );

  return [value, setValue];
}

/**
 * Array URL state
 * Stores array values as comma-separated string in URL search params
 */
export function useUrlStateArray(
  key: string,
  defaultValue: string[] = []
): [string[], (value: string[]) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const value = useMemo(() => {
    const param = searchParams.get(key);
    if (!param) return defaultValue;
    return param.split(',').filter(Boolean);
  }, [searchParams, key, defaultValue]);

  const setValue = useCallback(
    (newValue: string[]) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (newValue.length === 0 || JSON.stringify(newValue) === JSON.stringify(defaultValue)) {
          next.delete(key);
        } else {
          next.set(key, newValue.join(','));
        }
        return next;
      }, { replace: true });
    },
    [key, defaultValue, setSearchParams]
  );

  return [value, setValue];
}

/**
 * Object URL state (multiple params)
 * Stores each object property as a separate URL param with a prefix
 */
export function useUrlStateObject<T extends Record<string, string>>(
  prefix: string,
  defaultValues: T
): [T, (value: Partial<T>) => void, (key: keyof T, value: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const value = useMemo(() => {
    const result: Record<string, string> = {};
    for (const key of Object.keys(defaultValues)) {
      const paramKey = prefix ? `${prefix}_${key}` : key;
      result[key] = searchParams.get(paramKey) || defaultValues[key];
    }
    return result as T;
  }, [searchParams, prefix, defaultValues]);

  const setValues = useCallback(
    (newValues: Partial<T>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, val] of Object.entries(newValues)) {
          const paramKey = prefix ? `${prefix}_${key}` : key;
          if (val === defaultValues[key]) {
            next.delete(paramKey);
          } else {
            next.set(paramKey, val as string);
          }
        }
        return next;
      }, { replace: true });
    },
    [prefix, defaultValues, setSearchParams]
  );

  const setSingleValue = useCallback(
    (key: keyof T, newValue: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const paramKey = prefix ? `${prefix}_${String(key)}` : String(key);
        if (newValue === defaultValues[key]) {
          next.delete(paramKey);
        } else {
          next.set(paramKey, newValue);
        }
        return next;
      }, { replace: true });
    },
    [prefix, defaultValues, setSearchParams]
  );

  return [value, setValues, setSingleValue];
}

/**
 * Pagination URL state
 * Convenience hook for common pagination params
 */
export function useUrlPagination(defaults: { page?: number; limit?: number } = {}) {
  const { page: defaultPage = 1, limit: defaultLimit = 10 } = defaults;

  const [page, setPage] = useUrlStateNumber('page', defaultPage);
  const [limit, setLimit] = useUrlStateNumber('limit', defaultLimit);

  const reset = useCallback(() => {
    setPage(defaultPage);
  }, [setPage, defaultPage]);

  return {
    page,
    setPage,
    limit,
    setLimit,
    reset,
  };
}

/**
 * Tab URL state
 * Convenience hook for tab navigation
 */
export function useUrlTab<T extends string>(
  defaultTab: T,
  paramName: string = 'tab'
): [T, (tab: T) => void] {
  const [tab, setTab] = useUrlState(paramName, defaultTab);
  return [tab as T, setTab as (tab: T) => void];
}
