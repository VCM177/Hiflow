import {
  APPLICATION_TRANSITIONS,
  ApplicationStatus,
  canTransition,
  InterviewResult,
  OfferStatus,
} from '@hiflow/shared-types';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Interview } from '../interviews/entities/interview.entity';
import { Offer } from '../offers/entities/offer.entity';
import {
  APPLICATION_STATUS_LABEL,
  RACE_MESSAGE,
} from './applications.constants';
import { Application } from './entities/application.entity';
import { ApplicationStatusHistory } from './entities/application-status-history.entity';

/**
 * The single place where an application changes status. Both the status
 * endpoint and the offer flow go through it, so every rule holds on every path.
 *
 * Callers pass a transaction manager: the status change, its history row and
 * the side effects below either all happen or none do.
 */
@Injectable()
export class ApplicationWorkflowService {
  async moveTo(
    manager: EntityManager,
    application: Pick<Application, 'id' | 'status'>,
    to: ApplicationStatus,
    actorId: string,
    note: string | null,
  ): Promise<void> {
    const from = application.status;

    if (!canTransition(APPLICATION_TRANSITIONS, from, to)) {
      throw new ConflictException(
        `Không thể chuyển hồ sơ từ "${APPLICATION_STATUS_LABEL[from]}" sang "${APPLICATION_STATUS_LABEL[to]}"`,
      );
    }

    if (to === ApplicationStatus.REJECTED && !note) {
      throw new BadRequestException('Vui lòng nhập lý do từ chối');
    }

    await this.assertPreconditions(manager, application.id, to);

    // Conditioned on the status we read: of two simultaneous changes, one wins.
    const result = await manager.update(
      Application,
      { id: application.id, status: from },
      { status: to },
    );
    if (!result.affected) {
      throw new ConflictException(RACE_MESSAGE);
    }

    await manager.insert(ApplicationStatusHistory, {
      applicationId: application.id,
      fromStatus: from,
      toStatus: to,
      note,
      changedById: actorId,
    });

    if (
      to === ApplicationStatus.REJECTED ||
      to === ApplicationStatus.WITHDRAWN
    ) {
      await this.releasePendingWork(manager, application.id);
    }
  }

  private async assertPreconditions(
    manager: EntityManager,
    applicationId: string,
    to: ApplicationStatus,
  ): Promise<void> {
    if (to === ApplicationStatus.OFFER) {
      const passed = await manager.countBy(Interview, {
        applicationId,
        result: InterviewResult.PASSED,
      });
      const pending = await manager.countBy(Interview, {
        applicationId,
        result: InterviewResult.PENDING,
      });

      if (passed === 0) {
        throw new ConflictException(
          'Cần ít nhất một vòng phỏng vấn đạt trước khi đề nghị',
        );
      }
      if (pending > 0) {
        throw new ConflictException('Còn lịch phỏng vấn chưa có kết quả');
      }
    }

    if (to === ApplicationStatus.HIRED) {
      const accepted = await manager.existsBy(Offer, {
        applicationId,
        status: OfferStatus.ACCEPTED,
      });

      if (!accepted) {
        throw new ConflictException(
          'Chỉ chuyển sang Nhận việc khi ứng viên đã chấp nhận đề nghị',
        );
      }
    }
  }

  /** A rejected or withdrawn application must not keep live interviews or offers. */
  private async releasePendingWork(
    manager: EntityManager,
    applicationId: string,
  ): Promise<void> {
    await manager.update(
      Interview,
      { applicationId, result: InterviewResult.PENDING },
      { result: InterviewResult.CANCELLED },
    );
    await manager.update(
      Offer,
      { applicationId, status: OfferStatus.PENDING },
      { status: OfferStatus.DECLINED },
    );
  }
}
