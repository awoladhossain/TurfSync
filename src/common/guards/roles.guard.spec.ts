import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let mockGetAllAndOverride: jest.Mock;

  beforeEach(() => {
    mockGetAllAndOverride = jest.fn();
    const mockReflector = {
      getAllAndOverride: mockGetAllAndOverride,
    } as unknown as Reflector;
    guard = new RolesGuard(mockReflector);
  });

  const createMockContext = (user?: { role?: string }): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should deny access (default-deny) when no roles metadata exists', () => {
    mockGetAllAndOverride.mockReturnValue(undefined);
    const context = createMockContext({ role: Role.ADMIN });

    const result = guard.canActivate(context);

    expect(result).toBe(false);
    expect(mockGetAllAndOverride).toHaveBeenCalled();
  });

  it('should allow access when user role matches required roles', () => {
    mockGetAllAndOverride.mockReturnValue([Role.ADMIN]);
    const context = createMockContext({ role: Role.ADMIN });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should deny access when user role does not match required roles', () => {
    mockGetAllAndOverride.mockReturnValue([Role.ADMIN]);
    const context = createMockContext({ role: Role.USER });

    const result = guard.canActivate(context);

    expect(result).toBe(false);
  });

  it('should deny access when user is not present in request', () => {
    mockGetAllAndOverride.mockReturnValue([Role.ADMIN]);
    const context = createMockContext(undefined);

    const result = guard.canActivate(context);

    expect(result).toBe(false);
  });
});
