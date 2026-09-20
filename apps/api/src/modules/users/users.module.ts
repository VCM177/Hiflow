import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from '../departments/entities/department.entity';
import { User } from './entities/user.entity';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Department])],
  controllers: [UsersController, ProfileController],
  providers: [UsersService, ProfileService],
})
export class UsersModule {}
