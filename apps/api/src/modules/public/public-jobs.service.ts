import { JobStatus } from '@hiflow/shared-types';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  containsPattern,
  paginate,
  Paginated,
} from '../../common/pagination/paginate';
import { Job } from '../jobs/entities/job.entity';
import { PublicJobView, toPublicJobView } from './public-job-view';
import { ListPublicJobsQueryDto } from './public-jobs.dto';

const SORT_COLUMNS: Record<ListPublicJobsQueryDto['sortBy'], string> = {
  publishedAt: 'job.publishedAt',
  title: 'job.title',
};

@Injectable()
export class PublicJobsService {
  constructor(@InjectRepository(Job) private readonly jobs: Repository<Job>) {}

  async list(query: ListPublicJobsQueryDto): Promise<Paginated<PublicJobView>> {
    const qb = this.openJobs();

    if (query.search) {
      qb.andWhere('job.title ILIKE :q', { q: containsPattern(query.search) });
    }
    if (query.departmentId) {
      qb.andWhere('job.departmentId = :departmentId', {
        departmentId: query.departmentId,
      });
    }

    qb.orderBy(
      SORT_COLUMNS[query.sortBy],
      query.sortDir === 'asc' ? 'ASC' : 'DESC',
    ).addOrderBy('job.id', 'ASC');

    const page = await paginate(qb, query.page, query.limit);
    return { items: page.items.map(toPublicJobView), meta: page.meta };
  }

  /** A job that is a draft, closed or unknown is simply "not found". */
  async get(id: string): Promise<PublicJobView> {
    const job = await this.openJobs().andWhere('job.id = :id', { id }).getOne();

    if (!job) {
      throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    }

    return toPublicJobView(job);
  }

  /** Only jobs that are open for applications are ever public. */
  private openJobs(): SelectQueryBuilder<Job> {
    return this.jobs
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.department', 'department')
      .leftJoinAndSelect('job.position', 'position')
      .where('job.status = :open', { open: JobStatus.OPEN });
  }
}
