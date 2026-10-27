import { Module } from '@nestjs/common';
import { EmbeddingGateway } from './embedding.gateway';

@Module({
  providers: [EmbeddingGateway],
  exports: [EmbeddingGateway],
})
export class EmbeddingModule {}
