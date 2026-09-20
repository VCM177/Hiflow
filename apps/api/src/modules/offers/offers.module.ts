import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationsModule } from '../applications/applications.module';
import { Application } from '../applications/entities/application.entity';
import { Offer } from './entities/offer.entity';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Offer, Application]), ApplicationsModule],
  controllers: [OffersController],
  providers: [OffersService],
})
export class OffersModule {}
