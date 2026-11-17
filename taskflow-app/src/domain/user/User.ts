export interface User {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  provider: string;
  routineText: string | null;
}
