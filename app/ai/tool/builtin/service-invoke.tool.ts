/**
 * 内置工具：按类名反射调用 Nest 已注册 Service 的公开方法
 */
import { ModulesContainer } from '@nestjs/core';
import { BuiltinToolFactory } from '../tool.interface';

interface ServiceInvokeInput {
  service: string;
  method: string;
  args?: unknown[];
}

function resolveProviderToken(
  modulesContainer: ModulesContainer,
  serviceName: string,
): unknown {
  for (const nestModule of modulesContainer.values()) {
    for (const wrapper of nestModule.providers.values()) {
      const token = wrapper.token as { name?: string };
      if (wrapper.name === serviceName || token?.name === serviceName) {
        return wrapper.token;
      }
    }
  }
  throw new Error(`service "${serviceName}" is not registered in Nest container`);
}

const serviceInvokeTool: BuiltinToolFactory = ({ moduleRef }) => {
  const modulesContainer = moduleRef.get(ModulesContainer, { strict: false });

  return {
    name: 'service_invoke',
    description: 'Invoke a registered Nest service method by name',
    source: 'builtin' as const,
    inputSchema: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Nest provider class name',
        },
        method: {
          type: 'string',
          description: 'Method name on the service instance',
        },
        args: {
          type: 'array',
          description: 'Positional arguments passed to the method',
          items: {},
        },
      },
      required: ['service', 'method'],
    },
    async execute(input: unknown): Promise<unknown> {
      const payload = input as ServiceInvokeInput;
      if (!payload?.service || !payload?.method) {
        throw new Error('service_invoke requires service and method');
      }

      const token = resolveProviderToken(modulesContainer, payload.service);
      const instance = moduleRef.get(token as never, { strict: false }) as Record<
        string,
        unknown
      >;
      const fn = instance[payload.method];
      if (typeof fn !== 'function') {
        throw new Error(
          `method "${payload.method}" is not callable on ${payload.service}`,
        );
      }

      const args = Array.isArray(payload.args) ? payload.args : [];
      return fn.apply(instance, args);
    },
  };
};

export default serviceInvokeTool;
