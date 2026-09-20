import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobPosition } from './entities/job-position.entity';
import { PositionsController } from './positions.controller';
import { PositionsService } from './positions.service';

@Module({
  imports: [TypeOrmModule.forFeature([JobPosition])],
  controllers: [PositionsController],
  providers: [PositionsService],
})
export class PositionsModule {}
