import retrieveTool from './retrieve.tool';
import serviceInvokeTool from './service-invoke.tool';
import { BuiltinToolFactory } from '../tool.interface';

export const builtinTools: BuiltinToolFactory[] = [
  serviceInvokeTool,
  retrieveTool,
];
