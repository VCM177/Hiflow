import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogService } from '../../common/catalog/catalog.service';
import { TxRunner } from '../audit/tx-runner.service';
import { Department } from './entities/department.entity';

@Injectable()
export class DepartmentsService extends CatalogService<Department> {
  constructor(
    @InjectRepository(Department) repo: Repository<Department>,
    tx: TxRunner,
  ) {
    super(
      repo,
      {
        notFound: 'Không tìm thấy phòng ban',
        duplicate: 'Tên hoặc mã phòng ban đã tồn tại',
        inUse: 'Phòng ban đang được sử dụng nên không thể xóa',
      },
      tx,
      {
        created: 'DEPARTMENT_CREATED',
        updated: 'DEPARTMENT_UPDATED',
        deleted: 'DEPARTMENT_DELETED',
      },
    );
  }
}
