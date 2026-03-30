import { useSelector, useDispatch } from "react-redux";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  setSelectedPresident,
  setSelectedDate,
  setSelectedTermId,
} from "../../../store/presidencySlice";

import { setGazetteData } from "../../../store/gazetteDate";
import { Link, useLocation } from "react-router-dom";
import { EyeIcon } from "lucide-react";
import { useAllPresidents } from "../../../hooks/useAllPresidents";

export default function FilteredPresidentCards({ dateRange = [null, null] }) {
  const dispatch = useDispatch();
  const location = useLocation();
  const { data: presidentsArray, isLoading: isPresidentsLoading } = useAllPresidents();
  const selectedDate = useSelector((s) => s.presidency.selectedDate);
  const { selectedTermId } = useSelector((state) => state.presidency);

  const [searchTerm, setSearchTerm] = useState("");
  const prevDateRangeRef = useRef([null, null]);

  // 1. Flatten and Filter Presidents based on Date Range and Search
  const filteredPresidents = useMemo(() => {
    if (!presidentsArray || isPresidentsLoading) return [];

    const [rangeStart, rangeEnd] = dateRange;
    const allTerms = [];

    presidentsArray.forEach((p) => {
      p.terms.forEach((term, index) => {
        allTerms.push({
          ...p,
          term,
          termIndex: index,
          termId: `${p.id}_${term.start}`
        });
      });
    });

    return allTerms
      .filter((item) => {
        if (!rangeStart || !rangeEnd) return true;
        const presStart = new Date(item.term.start);
        const presEnd = item.term.end ? new Date(item.term.end) : new Date();
        return presStart < rangeEnd && presEnd > rangeStart;
      })
      .filter((item) => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return item.name.toLowerCase().includes(q) ||
          `${item.term.start.split("-")[0]} - ${item.term.end?.split("-")[0] || "Present"}`.includes(q);
      })
      .sort((a, b) => new Date(a.term.start) - new Date(b.term.start));
  }, [presidentsArray, isPresidentsLoading, dateRange, searchTerm]);

  // 2. Selection Logic (Updates Redux and Filters Gazettes)
  const selectPresidentAndDates = (item, urlSelectedDate = null) => {
    if (!item) {
      dispatch(setSelectedPresident(null));
      dispatch(setGazetteData([]));
      dispatch(setSelectedDate(null));
      dispatch(setSelectedTermId(null));
      return;
    }

    const { term, termId, ...president } = item;
    dispatch(setSelectedPresident(president));
    dispatch(setSelectedTermId(termId));

    // Refilter gazettes based on intersection of range and term
    const [rangeStart, rangeEnd] = dateRange;
    const presStart = new Date(term.start);
    const presEnd = term.end ? new Date(term.end) : new Date();

    const effectiveStart = rangeStart ? new Date(Math.max(presStart.getTime(), rangeStart.getTime())) : presStart;
    const effectiveEnd = rangeEnd ? new Date(Math.min(presEnd.getTime(), rangeEnd.getTime())) : presEnd;

    const filteredDates = (term.gazettes_published || [])
      .filter((d) => {
        const dd = new Date(d.date);
        return dd >= effectiveStart && (term.end ? dd < effectiveEnd : dd <= effectiveEnd);
      })
      .map(d => ({
        date: d.date,
        gazetteId: d.ids || [] // Compatible mapping for GazetteTimeline sources
      }));

    dispatch(setGazetteData(filteredDates));

    // Update the currently viewed date
    let dateToSet;
    if (urlSelectedDate) {
      dateToSet = { date: urlSelectedDate };
    } else if (filteredDates.length > 0) {
      dateToSet = filteredDates[filteredDates.length - 1]; // Pick latest in range
    } else {
      dateToSet = { date: effectiveEnd.toISOString().split("T")[0] };
    }
    dispatch(setSelectedDate(dateToSet));
  };

  // 3. Sync State with Component (Single Source of Truth)
  useEffect(() => {
    if (!presidentsArray?.length) return;

    const [currStart, currEnd] = dateRange;
    const [prevStart, prevEnd] = prevDateRangeRef.current;
    const isSameRange = currStart?.getTime() === prevStart?.getTime() && currEnd?.getTime() === prevEnd?.getTime();

    const params = new URLSearchParams(location.search);
    const urlSelectedDate = params.get("selectedDate");

    // Perform fresh selection if range changed OR if this is the initial mount with URL params
    if (!isSameRange || (urlSelectedDate && !prevStart)) {
      let targetItem;

      if (urlSelectedDate && !prevStart) {
        // Initial load: pick based on URL
        targetItem = filteredPresidents.find(p => {
          const start = new Date(p.term.start);
          const end = p.term.end ? new Date(p.term.end) : new Date();
          return new Date(urlSelectedDate) >= start && new Date(urlSelectedDate) < end;
        });
      }

      // If no URL match or it's a range move, ALWAYS pick the latest in range
      if (!targetItem) {
        targetItem = filteredPresidents[filteredPresidents.length - 1];
      }

      selectPresidentAndDates(targetItem, urlSelectedDate && !prevStart ? urlSelectedDate : null);
    }

    prevDateRangeRef.current = [currStart, currEnd];
  }, [dateRange, filteredPresidents]);

  // 4. Update URL whenever selectedDate changes
  useEffect(() => {
    if (selectedDate?.date) {
      const url = new URL(window.location.href);
      if (url.searchParams.get("selectedDate") !== selectedDate.date) {
        url.searchParams.set("selectedDate", selectedDate.date);
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [selectedDate]);

  return (
    <div className="rounded-lg w-full">
      {filteredPresidents.length > 4 && (
        <input
          type="text"
          className="border border-border bg-gray-800 text-gray-200 p-2 mb-3 w-full rounded placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
          placeholder="Search presidents..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      )}

      {filteredPresidents.length === 0 ? (
        <div className="text-left text-gray-500 py-2 text-xs md:text-sm italic">
          No president information found for the selected date range.
        </div>
      ) : (
        <div className="flex overflow-x-auto snap-x snap-mandatory md:grid md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3 pb-2 md:pb-0 no-scrollbar">
          {filteredPresidents.map((p) => {
            const isSelected = selectedTermId === p.termId;
            const startYear = p.term.start.split("-")[0];
            const endYear = p.term.end ? new Date(p.term.end).getFullYear() : "Present";
            const termDisplay = `${startYear} - ${endYear}`;

            return (
              <button
                key={p.termId}
                onClick={() => selectPresidentAndDates(p)}
                className={`min-w-[60vw] sm:min-w-[300px] md:min-w-0 flex-shrink-0 snap-center flex items-center p-1.5 md:p-2 rounded-lg border transition-all duration-200 hover:cursor-pointer
                  ${isSelected ? "bg-accent/20 border-accent/35 shadow-md" : "bg-foreground/5 border-primary/15 hover:bg-foreground/15"}`}
              >
                <img
                  src={p.imageUrl || p.image || ""}
                  alt={p.name}
                  className="md:w-14 w-10 md:h-14 h-10 object-cover rounded-full mr-3 border border-border flex-shrink-0"
                />
                <div className="flex flex-col flex-1 text-left min-w-0">
                  <p className={`font-medium text-xs md:text-sm break-words whitespace-normal ${isSelected ? "text-accent" : "text-primary"}`}>
                    {p.name}
                  </p>
                  <p className="text-xs md:text-sm text-primary/50 break-words whitespace-normal">
                    {termDisplay}
                  </p>
                  <div className="flex flex-nowrap gap-3 mt-1">
                    <Link
                      to={`/person-profile/${p?.id}`}
                      onClick={(e) => e.stopPropagation()}
                      state={{ mode: "back", from: location.pathname + location.search }}
                      className="text-primary/75 text-xs md:text-sm hover:text-accent transition-all duration-200 mt-1 flex"
                    >
                      <EyeIcon size={16} className="mr-1" />
                      View Profile
                    </Link>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
