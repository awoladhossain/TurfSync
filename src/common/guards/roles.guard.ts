import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, User } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * This guard is used to check if the user has the required roles to access a route. It uses the Roles decorator to get the required roles for a route and checks if the user's role is included in the required roles.
 * @returns A boolean value indicating whether the user has the required roles to access the route.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    // Get the user from the request object. The user is added to the request object by the AuthGuard.
    const request = context.switchToHttp().getRequest<{ user?: User }>();
    // If there is no user or the user does not have a role, return false. Otherwise, check if the user's role is included in the required roles.
    const user = request.user;
    if (!user || !user.role) return false;
    return requiredRoles.includes(user.role);
  }
}
