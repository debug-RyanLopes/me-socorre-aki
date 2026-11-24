import { Role, User } from '@prisma/client';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  login: string;
  role: Role;
  sectorId: number;
  mustChangePassword: boolean;
}

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    login: user.login,
    role: user.role,
    sectorId: user.sectorId,
    mustChangePassword: user.mustChangePassword,
  };
}
