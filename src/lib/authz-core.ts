import {
  isAccountDisabled,
  isAppRole,
  type AppRole,
} from "./authorization.ts";

type SessionIdentity = { user: { id: string } } | null;
type UserState = {
  id: string;
  role: unknown;
  banned: boolean | null;
  banExpires: Date | null;
};

export async function resolveAuthenticatedPrincipal(
  loadSession: () => Promise<SessionIdentity>,
  loadUser: (userId: string) => Promise<UserState | null>,
): Promise<{ id: string; role: AppRole } | null> {
  const session = await loadSession();
  if (!session) return null;

  const user = await loadUser(session.user.id);
  if (!user || isAccountDisabled(user) || !isAppRole(user.role)) return null;
  return { id: user.id, role: user.role };
}
