import type { OfferStatus } from '../statuses';

export interface OfferView {
  id: string;
  applicationId: string;
  salary: number;
  startDate: string;
  expiresAt: string | null;
  status: OfferStatus;
  note: string | null;
  createdBy: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
}
