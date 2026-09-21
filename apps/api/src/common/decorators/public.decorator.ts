import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route as public in the OpenAPI document, so it is not given a 401. */
export const PUBLIC_EXTENSION = 'x-public';

/** Opts a route out of the global JWT guard. */
export const Public = () =>
  applyDecorators(
    SetMetadata(IS_PUBLIC_KEY, true),
    ApiExtension(PUBLIC_EXTENSION, true),
  );
