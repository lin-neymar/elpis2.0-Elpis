import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ModelService } from './model.service';
import { ProjectService } from './project.service';

@Module({
  controllers: [ProjectController],
  providers: [ModelService, ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
