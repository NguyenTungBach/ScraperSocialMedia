export const PUBLIC_ROUTES = ['/', '/login'];

export const isPublicRoute = (path: string): boolean => {
  return PUBLIC_ROUTES.some((route) => {
    if (route === '/') {
      return path === '/';
    }
    return path === route || path.startsWith(`${route}/`);
  });
};
