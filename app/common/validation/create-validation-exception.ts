import { HttpException, HttpStatus, ValidationError } from '@nestjs/common';
import { formatValidationErrorsFor442 } from './format-validation-errors';

export function createValidationException(errors: ValidationError[]) {
  return new HttpException(
    {
      success: false,
      message: `request validate fail: ${formatValidationErrorsFor442(errors)}`,
      code: 442,
    },
    HttpStatus.OK,
  );
}
