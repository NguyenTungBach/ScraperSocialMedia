/** Khớp `frontend/src/utils/validate.js` (AWA) */

export const validateUserID = (userID: string): boolean => {
  if (!userID || Number(userID) <= 0) {
    return false;
  }
  return /^\d{1,15}$/.test(userID);
};

export const validPassword = (password: string): boolean => {
  if (!password) {
    return false;
  }
  return /^\S{8,16}$/.test(password);
};
