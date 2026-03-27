import { useQuery } from "@tanstack/react-query";
import { getAllPresidents } from "../services/services";
import { GC_TIME, STALE_TIME } from "../constants/constants";
import presidentDetails from "../assets/personImages.json";


export const useAllPresidents = () => {
    return useQuery({
        queryKey: ["presidents"],
        queryFn: async ({ signal }) => {
            const response = await getAllPresidents({ signal });
            const presidentsArray = response.presidents || [];

            return presidentsArray.map((president) => {
                const nameText = president.name;
                const matchedDetail = presidentDetails.find((detail) =>
                    detail.personName
                        .toLowerCase()
                        .includes(nameText.toLowerCase())
                );
                return {
                    ...president,
                    imageUrl: matchedDetail?.imageUrl || null,
                    themeColorLight: matchedDetail?.themeColorLight || null,
                };
            });
        },
        staleTime: STALE_TIME,
        gcTime: GC_TIME,
    });
};
