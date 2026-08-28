export type PageItem = number | 'ellipsis';

/**
 * Trang trước / 1 2 3 … 789 / trang sau
 * Luôn có trang đầu + trang cuối; hiện trang hiện tại và lân cận.
 */
export function buildPageItems(
  current: number,
  total: number,
  siblingCount = 1
): PageItem[] {
  const totalPages = Math.max(1, Math.floor(total) || 1);
  const page = Math.min(Math.max(1, Math.floor(current) || 1), totalPages);

  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);

  for (let i = page - siblingCount; i <= page + siblingCount; i += 1) {
    if (i >= 1 && i <= totalPages) pages.add(i);
  }

  // Gần đầu: hiện thêm vài trang đầu
  if (page <= siblingCount + 2) {
    for (let i = 1; i <= Math.min(3 + siblingCount, totalPages); i += 1) {
      pages.add(i);
    }
  }

  // Gần cuối: hiện thêm vài trang cuối
  if (page >= totalPages - siblingCount - 1) {
    for (let i = Math.max(1, totalPages - (2 + siblingCount)); i <= totalPages; i += 1) {
      pages.add(i);
    }
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const items: PageItem[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i]! - sorted[i - 1]! > 1) {
      items.push('ellipsis');
    }
    items.push(sorted[i]!);
  }
  return items;
}
