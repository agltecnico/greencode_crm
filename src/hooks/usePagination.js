import { useState, useMemo } from 'react';

export function usePagination(data, itemsPerPage = 10) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const safeCurrentPage = totalPages > 0 ? Math.min(currentPage, totalPages) : 1;

  const currentData = useMemo(() => {
    const start = (safeCurrentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return data.slice(start, end);
  }, [data, safeCurrentPage, itemsPerPage]);

  const nextPage = () => {
    setCurrentPage(Math.min(safeCurrentPage + 1, Math.max(totalPages, 1)));
  };

  const prevPage = () => {
    setCurrentPage(Math.max(safeCurrentPage - 1, 1));
  };

  const goToPage = (page) => {
    const pageNumber = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(pageNumber);
  };

  return {
    currentPage: safeCurrentPage,
    totalPages,
    currentData,
    nextPage,
    prevPage,
    goToPage,
    setCurrentPage
  };
}
