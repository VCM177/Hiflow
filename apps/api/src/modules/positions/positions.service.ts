import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogService } from '../../common/catalog/catalog.service';
import { JobPosition } from './entities/job-position.entity';

@Injectable()
export class PositionsService extends CatalogService<JobPosition> {
  constructor(@InjectRepository(JobPosition) repo: Repository<JobPosition>) {
    super(repo, {
      notFound: 'Không tìm thấy vị trí tuyển dụng',
      duplicate: 'Tên hoặc mã vị trí đã tồn tại',
      inUse: 'Vị trí đang được sử dụng nên không thể xóa',
    });
  }
}
