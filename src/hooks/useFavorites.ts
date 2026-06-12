import { useEffect, useState } from 'react';
import { FavoriteRecord, FavoriteItemType } from '../types';

export const FAVORITES_STORAGE_KEY = 'pickast_favorites';

const FAVORITE_TYPES: FavoriteItemType[] = ['briefing', 'topic_episode'];

type LegacyFavoriteLookup = Map<string, FavoriteRecord>;

function isFavoriteItemType(value: unknown): value is FavoriteItemType {
  return typeof value === 'string' && FAVORITE_TYPES.includes(value as FavoriteItemType);
}

function isFavoriteRecord(value: unknown): value is FavoriteRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Partial<FavoriteRecord>;
  return (
    typeof record.id === 'string' &&
    isFavoriteItemType(record.type) &&
    typeof record.title === 'string' &&
    typeof record.podcastName === 'string' &&
    typeof record.coverUrl === 'string' &&
    typeof record.topicTag === 'string' &&
    typeof record.addedAt === 'number' &&
    Number.isFinite(record.addedAt)
  );
}

function makeFavoriteKey(id: string, type: FavoriteItemType) {
  return `${type}:${id}`;
}

function dedupeFavorites(records: FavoriteRecord[]) {
  const seen = new Set<string>();
  const deduped: FavoriteRecord[] = [];

  for (const record of records) {
    const key = makeFavoriteKey(record.id, record.type);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(record);
  }

  return deduped;
}

function parseStoredFavorites(
  rawValue: string | null,
  legacyLookup: LegacyFavoriteLookup,
  seedFavorites: FavoriteRecord[]
) {
  if (!rawValue) {
    return dedupeFavorites(seedFavorites);
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const records = parsed.flatMap((item): FavoriteRecord[] => {
      if (typeof item === 'string') {
        const legacyFavorite = legacyLookup.get(item);
        return legacyFavorite ? [legacyFavorite] : [];
      }

      return isFavoriteRecord(item) ? [item] : [];
    });

    return dedupeFavorites(records);
  } catch {
    return [];
  }
}

type UseFavoritesOptions = {
  legacyLookup: LegacyFavoriteLookup;
  seedFavorites?: FavoriteRecord[];
};

export function useFavorites({
  legacyLookup,
  seedFavorites = [],
}: UseFavoritesOptions) {
  const [favorites, setFavorites] = useState<FavoriteRecord[]>(() => {
    if (typeof window === 'undefined') {
      return dedupeFavorites(seedFavorites);
    }

    return parseStoredFavorites(
      window.localStorage.getItem(FAVORITES_STORAGE_KEY),
      legacyLookup,
      seedFavorites
    );
  });

  useEffect(() => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const isFavorited = (id: string, type: FavoriteItemType) =>
    favorites.some((favorite) => favorite.id === id && favorite.type === type);

  const toggleFavorite = (favorite: FavoriteRecord) => {
    setFavorites((prev) => {
      const alreadyFavorited = prev.some(
        (item) => item.id === favorite.id && item.type === favorite.type
      );

      if (alreadyFavorited) {
        return prev.filter(
          (item) => !(item.id === favorite.id && item.type === favorite.type)
        );
      }

      return [favorite, ...prev];
    });
  };

  return {
    favorites,
    isFavorited,
    toggleFavorite,
  };
}
