import { Injectable } from '@nestjs/common';
import { createRequire } from 'module';
import { join } from 'path';

const nodeRequire = createRequire(__filename);

type ModelListItem = {
  model?: Record<string, unknown>;
  project?: Record<string, Record<string, unknown>>;
};

@Injectable()
export class ModelService {
  private readonly modelList: ModelListItem[];

  constructor() {
    const loadModelList = nodeRequire(join(__dirname, '../../../model/index.js'));
    this.modelList = loadModelList({});
  }

  getModelList(): ModelListItem[] {
    return this.modelList;
  }
}
