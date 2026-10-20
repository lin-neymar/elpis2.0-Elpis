const fs = require('fs');
const path = require('path');

const DEV = 'http://127.0.0.1:9002';
const templatePath = path.resolve(__dirname, '../../view/entry.tpl');

function toEntryModulePath(file) {
  const abs = path.resolve(file);
  const absPosix = abs.split(path.sep).join('/');
  const relative = path.relative(process.cwd(), abs).split(path.sep).join('/');
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return `/@fs${absPosix.startsWith('/') ? absPosix : `/${absPosix}`}`;
  }
  return `/${relative}`;
}

function writeDevTemplates(allEntries) {
  const template = fs.readFileSync(templatePath, 'utf8');
  const distDir = path.resolve(process.cwd(), './app/public/dist/');
  fs.mkdirSync(distDir, { recursive: true });

  Object.entries(allEntries).forEach(([entryName, file]) => {
    const entryModulePath = toEntryModulePath(file);
    const scripts = [
      `<script type="module" src="${DEV}/@vite/client"></script>`,
      `<script type="module" src="${DEV}${entryModulePath}"></script>`,
    ].join('\n');

    const html = template.includes('</body>')
      ? template.replace('</body>', `${scripts}\n</body>`)
      : `${template}\n${scripts}\n`;

    fs.writeFileSync(path.join(distDir, `${entryName}.tpl`), html);
  });
}

function collectCss(bundle, chunk, collected = new Set(), visited = new Set()) {
  if (!chunk || chunk.type !== 'chunk' || visited.has(chunk.fileName)) {
    return collected;
  }
  visited.add(chunk.fileName);
  (chunk.imports || []).forEach((fileName) => {
    collectCss(bundle, bundle[fileName], collected, visited);
  });
  const css = chunk.viteMetadata && chunk.viteMetadata.importedCss;
  if (css) {
    css.forEach((fileName) => collected.add(fileName));
  }
  return collected;
}

function toPublicUrl(fileName, outputDir) {
  const publicRoot = path.resolve(process.cwd(), './app/public');
  const relDir = path.relative(publicRoot, outputDir).split(path.sep).join('/');
  const prefix = relDir ? `/${relDir}` : '';
  return `${prefix}/${fileName}`.replace(/\/{2,}/g, '/');
}

function writeProdTemplates(allEntries, bundle, outputDir) {
  const template = fs.readFileSync(templatePath, 'utf8');
  const distDir = path.resolve(process.cwd(), './app/public/dist/');
  fs.mkdirSync(distDir, { recursive: true });

  Object.entries(allEntries).forEach(([entryName, entryFile]) => {
    const entryChunk = Object.values(bundle).find((item) => {
      if (item.type !== 'chunk' || !item.isEntry) {
        return false;
      }
      if (item.name === entryName) {
        return true;
      }
      return item.facadeModuleId && path.resolve(item.facadeModuleId) === path.resolve(entryFile);
    });
    if (!entryChunk) {
      return;
    }

    const tags = [];
    collectCss(bundle, entryChunk).forEach((fileName) => {
      tags.push(`<link rel="stylesheet" href="${toPublicUrl(fileName, outputDir)}">`);
    });
    tags.push(
      `<script type="module" src="${toPublicUrl(entryChunk.fileName, outputDir)}"></script>`,
    );

    const html = template.includes('</body>')
      ? template.replace('</body>', `${tags.join('\n')}\n</body>`)
      : `${template}\n${tags.join('\n')}\n`;

    fs.writeFileSync(path.join(distDir, `${entryName}.tpl`), html);
  });
}

module.exports = function elpisTplPlugin() {
  return {
    name: 'elpis-tpl-plugin',
    configureServer() {
      const { allEntries } = require('../config/vite.base.js');
      writeDevTemplates(allEntries);
    },
    generateBundle(options, bundle) {
      const { allEntries } = require('../config/vite.base.js');
      const outputDir = options.dir || path.resolve(process.cwd(), 'app/public/dist/prod');
      writeProdTemplates(allEntries, bundle, outputDir);
    },
  };
};
