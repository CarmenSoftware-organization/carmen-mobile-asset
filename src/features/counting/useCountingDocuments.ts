import { useQuery } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { createCountingDocumentRepo } from '../../data/repos/countingDocumentRepo';
import { createCountEntryRepo } from '../../data/repos/countEntryRepo';
import type { CountingDocument } from '../../data/api/carmenApi';

export interface CountingDocumentListEntry {
  document: CountingDocument;
  countedTotal: number;
}

export function useCountingDocuments(status: CountingDocument['status']) {
  const db = useDb();
  return useQuery({
    queryKey: ['countingDocuments', status],
    queryFn: async (): Promise<CountingDocumentListEntry[]> => {
      const docs = await createCountingDocumentRepo(db).list({ status });
      const totals = await createCountEntryRepo(db).countedTotalsByDocument(docs.map((d) => d.id));
      return docs.map((document) => ({ document, countedTotal: totals[document.id] ?? 0 }));
    },
  });
}
