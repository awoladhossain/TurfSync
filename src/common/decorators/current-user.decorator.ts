import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@prisma/client';

/**
 *  This decorator is used to get the current user from the request object. The user is added to the request object by the AuthGuard. This decorator can be used in any route handler to get the current user.
 * @param data The property of the user object to return. If not provided, the entire user object will be returned.
 * @returns The current user or the specified property of the current user.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: User }>();
    const user = request.user;
    if (!user) return null;
    return data ? user[data] : user;
  },
);
