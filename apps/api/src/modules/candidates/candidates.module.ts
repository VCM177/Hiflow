import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from '../applications/entities/application.entity';
import { StorageModule } from '../storage/storage.module';
import { CandidateAnonymizerService } from './candidate-anonymizer.service';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { Candidate } from './entities/candidate.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Candidate, Application]), StorageModule],
  controllers: [CandidatesController],
  providers: [CandidatesService, CandidateAnonymizerService],
  exports: [CandidateAnonymizerService],
})
export class CandidatesModule {}
