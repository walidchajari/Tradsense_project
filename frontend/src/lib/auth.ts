export const getCurrentUserId = () => {
  if (typeof window === 'undefined') return 1;
  const value = localStorage.getItem('auth_user_id');
  const parsed = value ? Number(value) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};
