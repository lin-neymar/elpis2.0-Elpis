// 引入前端工程化构建方法（包内相对路径，发布 npm 后仍可正确解析）
const FEBuildDev = require('./app/vite/dev.js');
const FEBuildProd = require('./app/vite/prod.js');

function loadEvalAssertions() {
  return require('./dist/ai/eval/assertions');
}

module.exports = {
  /*
   * 编译构建前端工程
   * @param env 环境变量 local/production
   */
  frontendBuild(env) {
    if (env === 'local') {
      FEBuildDev();
    } else if (env === 'production') {
      FEBuildProd();
    }
  },

  /*
   * 启动elpis
   * @param {Object} options - 启动参数，项目配置，透传到 Nest bootstrap
   */
  serverStart(options = {}) {
    const { bootstrap } = require('./dist/main');
    return bootstrap(options);
  },

  stepsContain(...args) {
    return loadEvalAssertions().stepsContain(...args);
  },

  outputNotEmpty(...args) {
    return loadEvalAssertions().outputNotEmpty(...args);
  },

  guardrailBlocked(...args) {
    return loadEvalAssertions().guardrailBlocked(...args);
  },

  outputContainsAny(...args) {
    return loadEvalAssertions().outputContainsAny(...args);
  },

  runAssertions(...args) {
    return loadEvalAssertions().runAssertions(...args);
  },
};
