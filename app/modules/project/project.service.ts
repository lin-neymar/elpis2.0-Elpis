import { Injectable } from '@nestjs/common';
import { ModelService } from './model.service';

@Injectable()
export class ProjectService {
  constructor(private readonly modelService: ModelService) {}

  /*
   * 获取所有模型与项目的结构化数据
   */
  async getModelList() {
    return this.modelService.getModelList();
  }

  /*
   * 获取统一模型下的项目列表（如果无 projKey ，全量获取）
   */
  async getList({ projKey }: { projKey?: string }) {
    const modelList = this.modelService.getModelList();
    return modelList.reduce((preList, modelItem) => {
      const { project } = modelItem;

      if (projKey && !project[projKey]) return preList;

      for (const pkey in project) {
        preList.push(project[pkey]);
      }
      return preList;
    }, [] as Record<string, unknown>[]);
  }

  /*
   * 根据 projKey 获取项目配置
   */
  async get(projKey: string) {
    let projConfig: Record<string, unknown> | undefined;
    const modelList = this.modelService.getModelList();
    modelList.forEach((modelItem) => {
      if (modelItem.project?.[projKey]) {
        projConfig = modelItem.project[projKey];
      }
    });
    return projConfig;
  }
}
