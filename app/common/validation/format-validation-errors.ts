import { ValidationError } from '@nestjs/common';

function mapConstraintsToAjvMessages(
  propertyPath: string,
  constraints: Record<string, string>,
): string[] {
  const keys = Object.keys(constraints);
  if (keys.includes('isNotEmpty') || keys.includes('isDefined')) {
    return [`data should have required property '${propertyPath}'`];
  }
  if (keys.includes('isString')) {
    return [`data.${propertyPath} should be string`];
  }
  if (keys.includes('isNumber') || keys.includes('isInt')) {
    return [`data.${propertyPath} should be number`];
  }
  return Object.values(constraints);
}

export function formatValidationErrorsFor442(errors: ValidationError[]): string {
  const parts: string[] = [];

  const walk = (list: ValidationError[], parentPath = '') => {
    for (const err of list) {
      const propertyPath = parentPath
        ? `${parentPath}.${err.property}`
        : err.property;

      if (err.children?.length) {
        walk(err.children, propertyPath);
        continue;
      }

      if (!err.constraints) {
        continue;
      }

      parts.push(
        ...mapConstraintsToAjvMessages(propertyPath, err.constraints),
      );
    }
  };

  walk(errors);
  return parts.join(', ');
}
