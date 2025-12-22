import { useQuery } from "@tanstack/react-query";
import { getPersonsByPortfolio } from "../services/services";

export const usePersonsByPortfolio = (portfolioId, date, presidentId) => {
  return useQuery({
    queryKey: ["personsByPortfolio", portfolioId, date, presidentId],
    queryFn: ({ signal }) =>
      getPersonsByPortfolio({ portfolioId, date, signal }),
    enabled: !!portfolioId && !!date && !!presidentId,
    staleTime: 1000 * 60 * 5, 
    gcTime: 1000 * 60 * 10,
  });
};