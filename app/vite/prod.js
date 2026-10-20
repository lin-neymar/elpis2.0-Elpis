const { build, mergeConfig } = require('vite');
const { baseConfig } = require('./config/vite.base.js');
const prodConfig = require('./config/vite.prod.js');

function printBuildResult(result) {
  const outputs = Array.isArray(result) ? result : [result];
  outputs.forEach((item) => {
    (item.output || []).forEach((file) => {
      console.log(file.fileName);
    });
  });
}

module.exports = async () => {
  console.log('\nbuilding...\n');
  const config = mergeConfig(baseConfig, prodConfig);
  try {
    const result = await build(config);
    printBuildResult(result);
  } catch (err) {
    console.log(err);
  }
};
