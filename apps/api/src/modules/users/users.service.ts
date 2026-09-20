import { UserRole } from '@hiflow/shared-types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { rethrowDbError } from '../../common/errors/db-errors';
import {
  containsPattern,
  paginate,
  Paginated,
} from '../../common/pagination/paginate';
import { hashPassword } from '../../common/security/password';
import type { AuthUser } from '../../common/types/auth-user';
import { Department } from '../departments/entities/department.entity';
import { User } from './entities/user.entity';
import { toUserView, UserView } from './user-view';
import { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from './users.dto';

const SORT_COLUMNS: Record<ListUsersQueryDto['sortBy'], string> = {
  fullName: 'account.fullName',
  email: 'account.email',
  role: 'account.role',
  createdAt: 'account.createdAt',
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Department)
    private readonly departments: Repository<Department>,
  ) {}

  async list(query: ListUsersQueryDto): Promise<Paginated<UserView>> {
    const qb = this.users
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.department', 'department');

    if (query.search) {
      qb.andWhere('(account.fullName ILIKE :q OR account.email ILIKE :q)', {
        q: containsPattern(query.search),
      });
    }
    if (query.role) {
      qb.andWhere('account.role = :role', { role: query.role });
    }
    if (query.departmentId) {
      qb.andWhere('account.departmentId = :departmentId', {
        departmentId: query.departmentId,
      });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('account.isActive = :isActive', { isActive: query.isActive });
    }

    qb.orderBy(
      SORT_COLUMNS[query.sortBy],
      query.sortDir === 'asc' ? 'ASC' : 'DESC',
    )
      // Tie-breaker keeps pages stable when the sort column has duplicates.
      .addOrderBy('account.id', 'ASC');

    const page = await paginate(qb, query.page, query.limit);
    return { items: page.items.map(toUserView), meta: page.meta };
  }

  async get(id: string): Promise<UserView> {
    const user = await this.users.findOne({
      where: { id },
      relations: { department: true },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    return toUserView(user);
  }

  async create(dto: CreateUserDto, actor: AuthUser): Promise<UserView> {
    this.assertCanGrantRole(actor, dto.role);
    await this.assertDepartmentExists(dto.departmentId);

    try {
      const saved = await this.users.save(
        this.users.create({
          email: dto.email,
          fullName: dto.fullName,
          role: dto.role,
          departmentId: dto.departmentId ?? null,
          passwordHash: await hashPassword(dto.password),
          isActive: true,
        }),
      );

      return await this.get(saved.id);
    } catch (error) {
      return rethrowDbError(error, { unique: 'Email đã được sử dụng' });
    }
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: AuthUser,
  ): Promise<UserView> {
    const user = await this.findEntity(id);
    this.assertCanManage(actor, user);

    if (dto.departmentId !== undefined) {
      await this.assertDepartmentExists(dto.departmentId);
      user.departmentId = dto.departmentId;
    }
    if (dto.fullName !== undefined) {
      user.fullName = dto.fullName;
    }

    await this.users.save(user);
    return this.get(id);
  }

  async assignRole(
    id: string,
    role: UserRole,
    actor: AuthUser,
  ): Promise<UserView> {
    if (id === actor.id) {
      throw new ForbiddenException(
        'Không thể tự thay đổi vai trò của chính mình',
      );
    }

    const user = await this.findEntity(id);
    this.assertCanManage(actor, user);
    this.assertCanGrantRole(actor, role);

    user.role = role;
    await this.users.save(user);
    return this.get(id);
  }

  async setStatus(
    id: string,
    isActive: boolean,
    actor: AuthUser,
  ): Promise<UserView> {
    if (id === actor.id && !isActive) {
      throw new ForbiddenException(
        'Không thể tự khóa tài khoản của chính mình',
      );
    }

    const user = await this.findEntity(id);
    this.assertCanManage(actor, user);

    user.isActive = isActive;
    await this.users.save(user);
    return this.get(id);
  }

  async resetPassword(
    id: string,
    newPassword: string,
    actor: AuthUser,
  ): Promise<void> {
    const user = await this.findEntity(id);
    this.assertCanManage(actor, user);

    await this.users.update(id, {
      passwordHash: await hashPassword(newPassword),
    });
  }

  private async findEntity(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    return user;
  }

  private async assertDepartmentExists(
    departmentId: string | null | undefined,
  ): Promise<void> {
    if (!departmentId) return;

    if (!(await this.departments.existsBy({ id: departmentId }))) {
      throw new BadRequestException('Phòng ban không tồn tại');
    }
  }

  /** Only an admin may hand out the admin role. */
  private assertCanGrantRole(actor: AuthUser, role: UserRole): void {
    if (role === UserRole.ADMIN && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Chỉ quản trị viên mới được cấp vai trò quản trị viên',
      );
    }
  }

  /** Only an admin may act on an admin account. */
  private assertCanManage(actor: AuthUser, target: User): void {
    if (target.role === UserRole.ADMIN && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Chỉ quản trị viên mới được thao tác trên tài khoản quản trị viên',
      );
    }
  }
}
