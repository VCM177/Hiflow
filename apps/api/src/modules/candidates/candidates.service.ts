import { UserRole } from '@hiflow/shared-types';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { endOfDayExclusive, startOfDay, toDateOnly } from '../../common/dates';
import { rethrowDbError } from '../../common/errors/db-errors';
import {
  containsPattern,
  paginate,
  Paginated,
} from '../../common/pagination/paginate';
import type { AuthUser } from '../../common/types/auth-user';
import { Application } from '../applications/entities/application.entity';
import { StorageService, UploadedFileData } from '../storage/storage.service';
import {
  CandidateDetailView,
  CandidateView,
  toCandidateView,
} from './candidate-view';
import {
  CreateCandidateDto,
  ListCandidatesQueryDto,
  UpdateCandidateDto,
} from './candidates.dto';
import { Candidate } from './entities/candidate.entity';

const SORT_COLUMNS: Record<ListCandidatesQueryDto['sortBy'], string> = {
  fullName: 'candidate.fullName',
  email: 'candidate.email',
  source: 'candidate.source',
  createdAt: 'candidate.createdAt',
};

const MIN_AGE_YEARS = 16;
const DUPLICATE_MESSAGE = 'Email ứng viên đã tồn tại';

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);

  constructor(
    @InjectRepository(Candidate)
    private readonly candidates: Repository<Candidate>,
    @InjectRepository(Application)
    private readonly applications: Repository<Application>,
    private readonly storage: StorageService,
  ) {}

  async list(
    query: ListCandidatesQueryDto,
    actor: AuthUser,
  ): Promise<Paginated<CandidateView>> {
    const qb = this.scopedQuery(actor);

    if (query.search) {
      qb.andWhere(
        '(candidate.fullName ILIKE :q OR candidate.email ILIKE :q OR candidate.phone ILIKE :q)',
        { q: containsPattern(query.search) },
      );
    }
    if (query.source) {
      qb.andWhere('candidate.source = :source', { source: query.source });
    }
    if (query.createdFrom) {
      qb.andWhere('candidate.createdAt >= :from', {
        from: startOfDay(query.createdFrom),
      });
    }
    if (query.createdTo) {
      qb.andWhere('candidate.createdAt < :to', {
        to: endOfDayExclusive(query.createdTo),
      });
    }

    qb.orderBy(
      SORT_COLUMNS[query.sortBy],
      query.sortDir === 'asc' ? 'ASC' : 'DESC',
    ).addOrderBy('candidate.id', 'ASC');

    const page = await paginate(qb, query.page, query.limit);
    return { items: page.items.map(toCandidateView), meta: page.meta };
  }

  async get(id: string, actor: AuthUser): Promise<CandidateDetailView> {
    const candidate = await this.findScoped(id, actor);

    const applications = await this.applications.find({
      where: { candidateId: id },
      relations: { job: true },
      order: { appliedAt: 'DESC' },
    });

    return {
      ...toCandidateView(candidate),
      applications: applications.map((a) => ({
        id: a.id,
        jobId: a.jobId,
        jobTitle: a.job?.title ?? '',
        status: a.status,
        appliedAt: a.appliedAt,
      })),
    };
  }

  async create(
    dto: CreateCandidateDto,
    actor: AuthUser,
  ): Promise<CandidateDetailView> {
    this.assertDob(dto.dob);

    try {
      const saved = await this.candidates.save(
        this.candidates.create({
          fullName: dto.fullName,
          email: dto.email,
          phone: dto.phone ?? null,
          dob: dto.dob ? toDateOnly(dto.dob) : null,
          source: dto.source,
          note: dto.note ?? null,
        }),
      );

      return await this.get(saved.id, actor);
    } catch (error) {
      return rethrowDbError(error, { unique: DUPLICATE_MESSAGE });
    }
  }

  async update(
    id: string,
    dto: UpdateCandidateDto,
    actor: AuthUser,
  ): Promise<CandidateDetailView> {
    const candidate = await this.findScoped(id, actor);
    this.assertDob(dto.dob);

    if (dto.fullName !== undefined) candidate.fullName = dto.fullName;
    if (dto.email !== undefined) candidate.email = dto.email;
    if (dto.phone !== undefined) candidate.phone = dto.phone;
    if (dto.source !== undefined) candidate.source = dto.source;
    if (dto.dob !== undefined) candidate.dob = toDateOnly(dto.dob);

    try {
      await this.candidates.save(candidate);
    } catch (error) {
      return rethrowDbError(error, { unique: DUPLICATE_MESSAGE });
    }

    return this.get(id, actor);
  }

  async setNote(
    id: string,
    note: string,
    actor: AuthUser,
  ): Promise<CandidateDetailView> {
    await this.findScoped(id, actor);
    await this.candidates.update(id, { note: note === '' ? null : note });
    return this.get(id, actor);
  }

  async attachCv(
    id: string,
    file: UploadedFileData,
    actor: AuthUser,
  ): Promise<CandidateDetailView> {
    const candidate = await this.findScoped(id, actor);
    const previous = candidate.cvFileUrl;

    // Validates the file and writes it; throws 400 before anything is saved.
    const { url } = await this.storage.upload(file);

    try {
      await this.candidates.update(id, { cvFileUrl: url });
    } catch (error) {
      // Do not leave an orphaned file behind if the row could not be updated.
      await this.discardFile(url);
      throw error;
    }

    if (previous) await this.discardFile(previous);
    return this.get(id, actor);
  }

  async removeCv(id: string, actor: AuthUser): Promise<CandidateDetailView> {
    const candidate = await this.findScoped(id, actor);

    if (!candidate.cvFileUrl) {
      throw new NotFoundException('Ứng viên chưa có CV');
    }

    await this.candidates.update(id, { cvFileUrl: null });
    await this.discardFile(candidate.cvFileUrl);
    return this.get(id, actor);
  }

  async remove(id: string, actor: AuthUser): Promise<void> {
    const candidate = await this.findScoped(id, actor);

    try {
      await this.candidates.delete(id);
    } catch (error) {
      return rethrowDbError(error, {
        foreignKey: 'Ứng viên đã có hồ sơ ứng tuyển nên không thể xóa',
      });
    }

    if (candidate.cvFileUrl) await this.discardFile(candidate.cvFileUrl);
  }

  /** An interviewer only sees candidates they are scheduled to interview. */
  private scopedQuery(actor: AuthUser): SelectQueryBuilder<Candidate> {
    const qb = this.candidates.createQueryBuilder('candidate');

    if (actor.role === UserRole.INTERVIEWER) {
      qb.andWhere(
        `EXISTS (
           SELECT 1 FROM applications a
           INNER JOIN interviews i ON i.application_id = a.id
           WHERE a.candidate_id = candidate.id AND i.interviewer_id = :me
         )`,
        { me: actor.id },
      );
    }

    return qb;
  }

  private async findScoped(id: string, actor: AuthUser): Promise<Candidate> {
    const candidate = await this.scopedQuery(actor)
      .andWhere('candidate.id = :id', { id })
      .getOne();

    if (!candidate) {
      throw new NotFoundException('Không tìm thấy ứng viên');
    }

    return candidate;
  }

  private assertDob(dob: string | undefined): void {
    if (!dob) return;

    const born = new Date(dob);
    const cutoff = new Date();
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - MIN_AGE_YEARS);

    if (Number.isNaN(born.getTime()) || born > cutoff) {
      throw new BadRequestException(
        `Ngày sinh không hợp lệ (ứng viên phải từ ${MIN_AGE_YEARS} tuổi)`,
      );
    }
  }

  /** Best effort: a leftover file is a nuisance, never a reason to fail the request. */
  private async discardFile(url: string): Promise<void> {
    try {
      await this.storage.remove(url);
    } catch (error) {
      this.logger.warn(
        `Could not delete ${url}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
