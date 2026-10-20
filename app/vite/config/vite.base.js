const fs = require('fs');
const glob = require('glob');
const path = require('path');
const vuePlugin = require('@vitejs/plugin-vue');
const elpisTplPlugin = require('../plugins/elpis-tpl-plugin');

const vue = vuePlugin.default || vuePlugin;

const blankModule = path.resolve(__dirname, '../libs/blank.js');

function withFallback(file) {
  return fs.existsSync(file) ? file : blankModule;
}

function handleFile(file, entries = {}) {
  const entryName = path.basename(file, '.js');
  entries[entryName] = file;
}

function scanEntries() {
  const elpisPageEntries = {};
  glob.sync(path.resolve(__dirname, '../../pages/**/entry.*.js')).forEach((file) => {
    handleFile(file, elpisPageEntries);
  });

  const businessPageEntries = {};
  glob.sync(path.resolve(process.cwd(), './app/pages/**/entry.*.js')).forEach((file) => {
    handleFile(file, businessPageEntries);
  });

  return Object.assign({}, elpisPageEntries, businessPageEntries);
}

const allEntries = scanEntries();

const baseConfig = {
  plugins: [vue(), elpisTplPlugin()],
  css: {
    preprocessorOptions: {
      // webpack less-loader 未传额外 options，沿用 less 默认行为
      less: {},
    },
  },
  build: {
    rollupOptions: {
      input: allEntries,
    },
  },
  resolve: {
    extensions: ['.js', '.vue', '.less', '.css'],
    alias: {
      vue: require.resolve('vue'),
      '@babel/runtime': path.resolve(require.resolve('@babel/runtime/helpers/asyncToGenerator'), '../..'),
      $elpisPages: path.resolve(__dirname, '../../pages'),
      $elpisCommon: path.resolve(__dirname, '../../pages/common'),
      $elpisCurl: path.resolve(__dirname, '../../pages/common/curl.js'),
      $elpisUtils: path.resolve(__dirname, '../../pages/common/utils.js'),
      $elpisWidgets: path.resolve(__dirname, '../../pages/widgets'),
      $elpisHeaderContainer: path.resolve(__dirname, '../../pages/widgets/header-container/header-container.vue'),
      $elpisSiderContainer: path.resolve(__dirname, '../../pages/widgets/sider-container/sider-container.vue'),
      $elpisSchemaTable: path.resolve(__dirname, '../../pages/widgets/schema-table/schema-table.vue'),
      $elpisSchemaForm: path.resolve(__dirname, '../../pages/widgets/schema-form/schema-form.vue'),
      $elpisSchemaSearchBar: path.resolve(__dirname, '../../pages/widgets/schema-search-bar/schema-search-bar.vue'),
      $elpisStore: path.resolve(__dirname, '../../pages/store'),
      $elpisBoot: path.resolve(__dirname, '../../pages/boot.js'),
      $businessDashboardRouterConfig: withFallback(path.resolve(process.cwd(), './app/pages/dashboard/router.js')),
      $businessComponentConfig: withFallback(
        path.resolve(process.cwd(), './app/pages/dashboard/complex-view/schema-view/components/component-config.js'),
      ),
      $businessFormItemConfig: withFallback(
        path.resolve(process.cwd(), './app/pages/widgets/schema-form/form-item-config.js'),
      ),
      $businessSearchItemConfig: withFallback(
        path.resolve(process.cwd(), './app/pages/widgets/schema-search-bar/search-item-config.js'),
      ),
      $businessHeaderConfig: withFallback(
        path.resolve(process.cwd(), './app/pages/widgets/header-container/header-container-config.js'),
      ),
    },
    dedupe: ['vue', 'element-plus'],
  },
};

module.exports = {
  allEntries,
  baseConfig,
};
