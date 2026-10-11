import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Objects and arrays counted from the body itself. The deepest valid TipTap body
 * (20 nodes, a link mark at the bottom) is 43, so real requests stay far below.
 */
export const MAX_JSON_DEPTH = 64;

/**
 * Runs before ValidationPipe: class-transformer recurses into the whole value and a
 * very deep body overflows the stack (500). This walk uses an explicit stack, so it
 * cannot overflow, and stops at the first container that is too deep.
 */
@Injectable()
export class JsonDepthPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    // Custom decorators (CurrentUser) carry server objects, not client input.
    if (metadata.type === 'custom' || typeof value !== 'object' || value === null) return value;

    const stack: Array<{ node: object; depth: number; field: string }> = Object.entries(value)
      .filter(([, child]) => typeof child === 'object' && child !== null)
      .map(([field, child]) => ({ node: child as object, depth: 2, field }));

    while (stack.length > 0) {
      const { node, depth, field } = stack.pop()!;
      if (depth > MAX_JSON_DEPTH) {
        throw new BadRequestException({
          message: 'Validation failed',
          details: [{ field, message: `${field} is nested too deeply` }],
        });
      }
      for (const child of Object.values(node)) {
        if (typeof child === 'object' && child !== null) stack.push({ node: child as object, depth: depth + 1, field });
      }
    }
    return value;
  }
}
