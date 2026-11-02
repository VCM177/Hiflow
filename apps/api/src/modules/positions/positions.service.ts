import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogService } from '../../common/catalog/catalog.service';
import { TxRunner } from '../audit/tx-runner.service';
import { JobPosition } from './entities/job-position.entity';

@Injectable()
export class PositionsService extends CatalogService<JobPosition> {
  constructor(
    @InjectRepository(JobPosition) repo: Repository<JobPosition>,
    tx: TxRunner,
  ) {
    super(
      repo,
      {
        notFound: 'Không tìm thấy vị trí tuyển dụng',
        duplicate: 'Tên hoặc mã vị trí đã tồn tại',
        inUse: 'Vị trí đang được sử dụng nên không thể xóa',
      },
      tx,
      {
        created: 'POSITION_CREATED',
        updated: 'POSITION_UPDATED',
        deleted: 'POSITION_DELETED',
      },
    );
  }
}
