/** Catalog consumer hooks. */

import { useContext } from 'react';
import { CatalogContext, type CatalogContextValue } from './catalogStore';

export function useCatalog(): CatalogContextValue {
  const context = useContext(CatalogContext);
  if (!context) throw new Error('useCatalog must be used within a CatalogProvider');
  return context;
}

/** Convenience accessor for components that only render navigation. */
export function useCategories() {
  return useCatalog().categories;
}
