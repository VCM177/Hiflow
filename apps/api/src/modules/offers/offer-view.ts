import type { OfferView } from '@hiflow/shared-types';
import { Offer } from './entities/offer.entity';

export const toOfferView = (o: Offer): OfferView => ({
  id: o.id,
  applicationId: o.applicationId,
  salary: o.salary,
  startDate: o.startDate,
  expiresAt: o.expiresAt,
  status: o.status,
  note: o.note,
  createdBy: o.createdBy
    ? { id: o.createdBy.id, name: o.createdBy.fullName }
    : null,
  createdAt: o.createdAt,
  updatedAt: o.updatedAt,
});
