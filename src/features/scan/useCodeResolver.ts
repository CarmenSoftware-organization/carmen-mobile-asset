import { useMemo } from 'react';
import { useDb } from '../../data/db/dbContext';
import { useCarmenApi } from '../../data/api/carmenApiContext';
import { createAssetRepo } from '../../data/repos/assetRepo';
import { createCodeResolver, type CodeResolver } from './codeResolver';

export function useCodeResolver(): CodeResolver {
  const db = useDb();
  const api = useCarmenApi();
  return useMemo(() => createCodeResolver(createAssetRepo(db), api), [db, api]);
}
