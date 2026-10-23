import { Controller, Get, Query } from '@nestjs/common';
import { BaseController } from '../../common/base/base.controller';
import { GetListDto } from './dto/get-list.dto';
import { GetProjectDto } from './dto/get-project.dto';
import { ProjectService } from './project.service';

@Controller('api/project')
export class ProjectController extends BaseController {
  constructor(private readonly projectService: ProjectService) {
    super();
  }

  @Get('model_list')
  async getModelList() {
    const modelList = await this.projectService.getModelList();

    const dtoModelList = modelList.reduce((preList, item) => {
      const { model, project } = item;

      const { key, name, desc } = model as {
        key: string;
        name: string;
        desc: string;
      };
      const dtoModel = { key, name, desc };

      const dtoProject: Record<
        string,
        { key: string; name: string; desc: string; homePage: string }
      > = {};
      for (const projKey in project) {
        const { key, name, desc, homePage } = project[projKey] as {
          key: string;
          name: string;
          desc: string;
          homePage: string;
        };
        dtoProject[projKey] = { key, name, desc, homePage };
      }

      preList.push({
        model: dtoModel,
        project: dtoProject,
      });

      return preList;
    }, []);

    return this.success(dtoModelList);
  }

  @Get('list')
  async getList(@Query() query: GetListDto) {
    const { proj_key: projKey } = query;
    const projectList = await this.projectService.getList({ projKey });

    const dtoProjectList = projectList.map((item) => {
      const { modelKey, key, name, desc, homePage } = item as {
        modelKey: string;
        key: string;
        name: string;
        desc: string;
        homePage: string;
      };
      return { modelKey, key, name, desc, homePage };
    });

    return this.success(dtoProjectList);
  }

  @Get()
  async get(@Query() query: GetProjectDto) {
    const { proj_key: projKey } = query;
    const projConfig = await this.projectService.get(projKey);

    if (!projConfig) {
      return this.fail('获取项目异常', 50000);
    }

    return this.success(projConfig);
  }
}
