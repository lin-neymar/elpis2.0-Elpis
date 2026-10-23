import { Type } from '@nestjs/common';
import * as fs from 'fs';
import { createRequire } from 'module';
import * as path from 'path';
import glob = require('glob');

const runtimeRequire = createRequire(__filename);

const frameworkNodeModules = path.resolve(__dirname, '../../node_modules');
const businessModulesSegment = `${path.sep}dist${path.sep}modules${path.sep}`;

/** 业务仓编译产物 require('@nestjs/*') 时走到框架依赖，demo 不必自行安装。 */
function ensureFrameworkNodePath() {
  const parts = (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean);
  if (parts.includes(frameworkNodeModules)) {
    return;
  }
  process.env.NODE_PATH = [frameworkNodeModules, ...parts].join(path.delimiter);
  require('module').Module._initPaths();
}

/**
 * demo/node_modules 若 hoist 了另一份 @nestjs/*，会与框架 DI 的 token 不一致。
 * 凡从 dist/modules 内发起的 @nestjs/* 解析，强制走框架 node_modules（方案 2）。
 */
let businessNestResolveHookInstalled = false;

function installBusinessNestResolveHook() {
  if (businessNestResolveHookInstalled) {
    return;
  }
  businessNestResolveHookInstalled = true;

  const frameworkRequire = createRequire(
    path.join(frameworkNodeModules, '@nestjs/core/package.json'),
  );
  type ModuleWithResolve = typeof import('module') & {
    _resolveFilename: (
      request: string,
      parent: NodeModule | undefined,
      isMain: boolean,
      options?: unknown,
    ) => string;
  };
  const Module = require('module') as ModuleWithResolve;
  const originalResolveFilename = Module._resolveFilename;

  Module._resolveFilename = function (
    request: string,
    parent: NodeModule | undefined,
    isMain: boolean,
    options?: unknown,
  ): string {
    const parentFilename = parent?.filename ?? '';
    if (request.startsWith('@nestjs/') && parentFilename.includes(businessModulesSegment)) {
      return frameworkRequire.resolve(request);
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
  };
}

installBusinessNestResolveHook();

/**
 * 扫描业务仓 process.cwd() 下 dist/modules 中全部 .module.js（仅编译产物，不扫框架 src）。
 * 顺序：glob 结果按路径字母序；Fallback 由 ElpisModule 在扫描结果之后单独 import。
 * 业务仓 build 前应清空 dist/modules，避免无 TS 源的历史 .module.js 被加载。
 */
export function loadBusinessModules(): Type[] {
  ensureFrameworkNodePath();

  const modulesDir = path.resolve(process.cwd(), 'dist/modules');
  if (!fs.existsSync(modulesDir)) {
    return [];
  }
  const files = glob.sync('**/*.module.js', { cwd: modulesDir }).sort();

  const loaded: Type[] = [];
  const seen = new Set<Type>();

  for (const relativePath of files) {
    const exported = runtimeRequire(path.resolve(modulesDir, relativePath)) as Record<
      string,
      unknown
    >;

    for (const exportName of Object.keys(exported)) {
      if (!exportName.endsWith('Module')) {
        continue;
      }
      const candidate = exported[exportName];
      if (typeof candidate !== 'function') {
        continue;
      }
      const moduleType = candidate as Type;
      if (seen.has(moduleType)) {
        continue;
      }
      seen.add(moduleType);
      loaded.push(moduleType);
    }
  }

  return loaded;
}
