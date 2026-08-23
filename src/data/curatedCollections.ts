import type { IDiscoveryBook } from '../services/discoveryService';
import collectionsData from './curated_collections_100.json';

export interface ICuratedCollection {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  books: IDiscoveryBook[];
}

export const CURATED_COLLECTIONS: ICuratedCollection[] = collectionsData as ICuratedCollection[];
