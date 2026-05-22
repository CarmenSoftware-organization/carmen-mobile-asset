export interface Asset {
  id: string;
  code: string;
  name: string;
  category: string | null;
  department: string | null;
  locationId: string | null;
  locationName: string | null;
  quantity: number | null;
  remainQty: number | null;
  price: number | null;
  currency: string | null;
  totalAmount: number | null;
  inputDate: string | null;
  acquireDate: string | null;
  assetLife: string | null;
  remark: string | null;
  imageUrl: string | null;
  updatedAt: string;
}

export interface Location {
  id: string;
  name: string;
  updatedAt: string;
}

export type MutationKind = 'document.upsert' | 'document.commit' | 'entry.upsert' | 'photo.upload';

export interface PendingMutation {
  id: string;
  idempotencyKey: string;
  kind: MutationKind;
  payload: unknown;
  createdAt: string;
  attempts: number;
  lastError: string | null;
  status: 'pending' | 'in_flight' | 'failed';
}
