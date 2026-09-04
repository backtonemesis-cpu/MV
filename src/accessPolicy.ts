export const MV_OWNER_EMAIL = 'backtonemesis@gmail.com';
export const MV_SINGLE_USER_MODE = true;

export function isMvOwnerEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.trim().toLowerCase() === MV_OWNER_EMAIL);
}
