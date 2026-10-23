const assert = require('assert');
const fs = require('fs');
const path = require('path');
const supertest = require('supertest');
const md5 = require('md5');

const signKey = 'klx05hb3n1c9ujp8uhxbs2ikkiowp212';
const st = Date.now();

const demoDir = path.resolve(__dirname, '../../../elpis2.0-demo');
const hasDemo = fs.existsSync(demoDir);

(hasDemo ? describe : describe.skip)('测试 project 相关接口', function () {
  this.timeout(60000);

  let modelList;
  const projectList = [];
  let request;
  const previousCwd = process.cwd();

  after(function () {
    process.chdir(previousCwd);
  });

  it('启动 Nest 应用', async () => {
    process.chdir(demoDir);
    process.env._ENV = process.env._ENV || 'local';

    const { createElpisApp } = require('../../dist/main');
    const app = await createElpisApp({});
    request = supertest(app.getHttpServer());

    const loadModelList = require(path.resolve(__dirname, '../../model/index.js'));
    modelList = loadModelList({});
    modelList.forEach((modelItem) => {
      const { project } = modelItem;
      for (const pKey in project) {
        projectList.push(project[pKey]);
      }
    });
  });

  it('GET /api/project/model_list', async () => {
    let tmpRequest = request.get('/api/project/model_list');
    tmpRequest = tmpRequest.set('s_t', st);
    tmpRequest = tmpRequest.set('s_sign', md5(`${signKey}_${st}`));
    const res = await tmpRequest;
    assert(res.body.success === true);

    const resData = res.body.data;
    assert(resData.length > 0);

    for (let i = 0; i < resData.length; ++i) {
      const item = resData[i];
      assert(item.model);
      assert(item.model.key);
      assert(item.model.name);
      assert(item.project);
      for (const projKey in item.project) {
        assert(item.project[projKey].key);
        assert(item.project[projKey].name);
      }
    }
  });

  it('GET /api/project/list without proj_key', async () => {
    let tmpRequest = request.get('/api/project/list');
    tmpRequest = tmpRequest.set('s_t', st);
    tmpRequest = tmpRequest.set('s_sign', md5(`${signKey}_${st}`));
    const res = await tmpRequest;
    assert(res.body.success === true);

    const resData = res.body.data;
    assert(resData.length === projectList.length);
    for (let i = 0; i < resData.length; ++i) {
      const item = resData[i];
      assert(item.modelKey);
      assert(item.key);
      assert(item.name);
      assert(item.desc !== undefined);
      assert(item.homePage !== undefined);
    }
  });

  it('GET /api/project/list with proj_key', async () => {
    const projKey = projectList[Math.floor(Math.random() * projectList.length)].key;
    const { modelKey } = projectList.find((item) => item.key === projKey);
    let tmpRequest = request.get('/api/project/list');
    tmpRequest = tmpRequest.set('s_t', st);
    tmpRequest = tmpRequest.set('s_sign', md5(`${signKey}_${st}`));
    tmpRequest = tmpRequest.query({
      proj_key: projKey,
    });
    const res = await tmpRequest;
    assert(res.body.success === true);

    const resData = res.body.data;
    assert(projectList.filter((item) => item.modelKey === modelKey).length === resData.length);
    for (let i = 0; i < resData.length; ++i) {
      const item = resData[i];
      assert(item.modelKey);
      assert(item.key);
      assert(item.name);
      assert(item.desc !== undefined);
      assert(item.homePage !== undefined);
    }
  });

  it('GET /api/project without proj_key', async () => {
    let tmpRequest = request.get('/api/project');
    tmpRequest = tmpRequest.set('s_t', st);
    tmpRequest = tmpRequest.set('s_sign', md5(`${signKey}_${st}`));
    const res = await tmpRequest;
    assert(res.body.success === false);

    const resBody = res.body;
    assert(resBody.code === 442);
    assert(
      resBody.message.indexOf(
        "request validate fail: data should have required property 'proj_key'",
      ) > -1,
    );
  });

  it('GET /api/project fail', async () => {
    let tmpRequest = request.get('/api/project');
    tmpRequest = tmpRequest.set('s_t', st);
    tmpRequest = tmpRequest.set('s_sign', md5(`${signKey}_${st}`));
    tmpRequest = tmpRequest.query({
      proj_key: 'xxxxxxxx',
    });
    const res = await tmpRequest;
    assert(res.body.success === false);

    const resBody = res.body;
    assert(resBody.code === 50000);
    assert(resBody.message === '获取项目配置异常');
  });

  it('GET /api/project with proj_key', async () => {
    for (let i = 0; i < projectList.length; ++i) {
      const projItem = projectList[i];
      const { key: projKey } = projItem;

      let tmpRequest = request.get('/api/project');
      tmpRequest = tmpRequest.set('s_t', st);
      tmpRequest = tmpRequest.set('s_sign', md5(`${signKey}_${st}`));
      tmpRequest = tmpRequest.query({
        proj_key: projKey,
      });

      const res = await tmpRequest;
      assert(res.body.success === true);

      const resData = res.body.data;
      assert(resData.key === projKey);
      assert(resData.modelKey);
      assert(resData.desc !== undefined);
      assert(resData.homePage !== undefined);

      const { menu } = resData;
      menu.forEach((menuItem) => {
        checkMenuItem(menuItem);
      });

      function checkMenuItem(menuItem) {
        assert(menuItem.key);
        assert(menuItem.name);
        assert(menuItem.menuType);

        if (menuItem.menuType === 'group') {
          assert(menuItem.subMenu !== undefined);
          menuItem.subMenu.forEach((subMenuItem) => {
            checkMenuItem(subMenuItem);
          });
        }
        if (menuItem.menuType === 'module') {
          checkModule(menuItem);
        }
      }

      function checkModule(menuItem) {
        const { moduleType } = menuItem;
        assert(moduleType);

        if (moduleType === 'sider') {
          const { siderConfig } = menuItem;
          assert(siderConfig);
          assert(siderConfig.menu);
          siderConfig.menu.forEach((siderMenuItem) => {
            checkMenuItem(siderMenuItem);
          });
        }

        if (moduleType === 'iframe') {
          const { iframeConfig } = menuItem;
          assert(iframeConfig);
          assert(iframeConfig.path !== undefined);
        }

        if (moduleType === 'custom') {
          const { customConfig } = menuItem;
          assert(customConfig);
          assert(customConfig.path !== undefined);
        }

        if (moduleType === 'schema') {
          const { schemaConfig } = menuItem;
          assert(schemaConfig);
          assert(schemaConfig.api !== undefined);
          assert(schemaConfig.schema);
        }
      }
    }
  });
});

if (!hasDemo) {
  console.warn('[test] 未找到同级 elpis2.0-demo，project 接口测试已 skip');
}
