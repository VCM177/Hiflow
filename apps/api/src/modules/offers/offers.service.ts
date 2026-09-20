import { ApplicationStatus, OfferStatus } from '@hiflow/shared-types';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { toDateOnly } from '../../common/dates';
import { rethrowDbError } from '../../common/errors/db-errors';
import type { AuthUser } from '../../common/types/auth-user';
import { ApplicationWorkflowService } from '../applications/application-workflow.service';
import { Application } from '../applications/entities/application.entity';
import { Offer } from './entities/offer.entity';
import { OfferView, toOfferView } from './offer-view';
import { CreateOfferDto, RespondOfferDto, UpdateOfferDto } from './offers.dto';

const today = (): string => new Date().toISOString().slice(0, 10);

@Injectable()
export class OffersService {
  constructor(
    @InjectRepository(Offer) private readonly offers: Repository<Offer>,
    @InjectRepository(Application)
    private readonly applications: Repository<Application>,
    private readonly workflow: ApplicationWorkflowService,
    private readonly dataSource: DataSource,
  ) {}

  async get(applicationId: string): Promise<OfferView> {
    return toOfferView(await this.findOffer(applicationId));
  }

  async create(
    applicationId: string,
    dto: CreateOfferDto,
    actor: AuthUser,
  ): Promise<OfferView> {
    const application = await this.applications.findOneBy({
      id: applicationId,
    });
    if (!application) {
      throw new NotFoundException('Không tìm thấy hồ sơ ứng tuyển');
    }
    if (application.status !== ApplicationStatus.OFFER) {
      throw new ConflictException(
        'Chỉ tạo đề nghị khi hồ sơ đang ở trạng thái Đề nghị',
      );
    }

    const startDate = toDateOnly(dto.startDate);
    const expiresAt = dto.expiresAt ? toDateOnly(dto.expiresAt) : null;
    this.assertDates(startDate, expiresAt);

    try {
      await this.offers.save(
        this.offers.create({
          applicationId,
          salary: dto.salary,
          startDate,
          expiresAt,
          note: dto.note ?? null,
          status: OfferStatus.PENDING,
          createdById: actor.id,
        }),
      );
    } catch (error) {
      return rethrowDbError(error, {
        unique: 'Hồ sơ này đã có đề nghị tuyển dụng',
      });
    }

    return this.get(applicationId);
  }

  async update(applicationId: string, dto: UpdateOfferDto): Promise<OfferView> {
    const offer = await this.findOffer(applicationId);
    this.assertPending(offer);

    const startDate =
      dto.startDate !== undefined ? toDateOnly(dto.startDate) : offer.startDate;
    const expiresAt =
      dto.expiresAt !== undefined ? toDateOnly(dto.expiresAt) : offer.expiresAt;
    this.assertDates(startDate, expiresAt);

    if (dto.salary !== undefined) offer.salary = dto.salary;
    if (dto.note !== undefined) offer.note = dto.note;
    offer.startDate = startDate;
    offer.expiresAt = expiresAt;

    // The creator relation is loaded for the view; do not write it back.
    offer.createdBy = undefined;
    await this.offers.save(offer);
    return this.get(applicationId);
  }

  /**
   * Records the candidate's answer and moves the application in the same
   * transaction: accepting hires them, declining marks them withdrawn.
   */
  async respond(
    applicationId: string,
    dto: RespondOfferDto,
    actor: AuthUser,
  ): Promise<OfferView> {
    const offer = await this.findOffer(applicationId);
    this.assertPending(offer);

    if (dto.accepted && offer.expiresAt && offer.expiresAt < today()) {
      throw new ConflictException('Đề nghị đã hết hạn, không thể chấp nhận');
    }

    await this.dataSource.transaction(async (manager) => {
      const outcome = await manager.update(
        Offer,
        { id: offer.id, status: OfferStatus.PENDING },
        { status: dto.accepted ? OfferStatus.ACCEPTED : OfferStatus.DECLINED },
      );
      if (!outcome.affected) {
        throw new ConflictException('Đề nghị vừa được phản hồi bởi người khác');
      }

      const application = await manager.findOneByOrFail(Application, {
        id: applicationId,
      });

      await this.workflow.moveTo(
        manager,
        application,
        dto.accepted ? ApplicationStatus.HIRED : ApplicationStatus.WITHDRAWN,
        actor.id,
        dto.note ??
          (dto.accepted
            ? 'Ứng viên chấp nhận đề nghị'
            : 'Ứng viên từ chối đề nghị'),
      );
    });

    return this.get(applicationId);
  }

  private async findOffer(applicationId: string): Promise<Offer> {
    const offer = await this.offers.findOne({
      where: { applicationId },
      relations: { createdBy: true },
    });

    if (!offer) {
      throw new NotFoundException('Hồ sơ này chưa có đề nghị tuyển dụng');
    }

    return offer;
  }

  private assertPending(offer: Offer): void {
    if (offer.status !== OfferStatus.PENDING) {
      throw new ConflictException(
        'Đề nghị đã được phản hồi, không thể thay đổi',
      );
    }
  }

  private assertDates(startDate: string, expiresAt: string | null): void {
    const now = today();

    if (startDate < now) {
      throw new BadRequestException(
        'Ngày nhận việc không được ở trong quá khứ',
      );
    }
    if (expiresAt !== null) {
      if (expiresAt < now) {
        throw new BadRequestException(
          'Hạn phản hồi không được ở trong quá khứ',
        );
      }
      if (expiresAt > startDate) {
        throw new BadRequestException(
          'Hạn phản hồi không được sau ngày nhận việc',
        );
      }
    }
  }
}
