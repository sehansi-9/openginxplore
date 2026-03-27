import { useSelector, useDispatch } from "react-redux";
import { useState, useMemo, useEffect, useRef } from "react";
import utils from "../../../utils/utils";
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
  const { data: presidentsArray, isLoading: isPresidentsLoading } = useAllPresidents();
  const gazetteDateClassic = useSelector((s) => s.gazettes.gazetteDataClassic);
  const selectedPresident = useSelector((s) => s.presidency.selectedPresident);
  const selectedDate = useSelector((s) => s.presidency.selectedDate);

  const [searchTerm, setSearchTerm] = useState("");
  const [initializedFromUrl, setInitializedFromUrl] = useState(false);
  const [urlInitComplete, setUrlInitComplete] = useState(false);
  const prevDateRangeRef = useRef([null, null]);
  const lastProcessedUrlRef = useRef("");

  const location = useLocation()

  const filteredPresidents = useMemo(() => {
    if (!presidentsArray || isPresidentsLoading) return [];

    const [rangeStart, rangeEnd] = dateRange;

    // Flatten presidents into individual terms
    const allTerms = [];
    presidentsArray.forEach((p) => {
      p.terms.forEach((term, index) => {
        allTerms.push({
          ...p,
          term,
          termIndex: index,
          // Unique key for the card: presidentId + term start
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
        const nameText = item.name;

        const q = searchTerm.toLowerCase();
        const matchesName = nameText.toLowerCase().includes(q);

        const startYear = item.term.start.split("-")[0];
        const endYear = item.term.end ? new Date(item.term.end).getFullYear() : "Present";
        const termStr = `${startYear} - ${endYear}`;
        const matchesTerm = termStr.toLowerCase().includes(q);

        return matchesName || matchesTerm;
      })
      .sort((a, b) => new Date(a.term.start) - new Date(b.term.start));

  }, [presidentsArray, isPresidentsLoading, dateRange, searchTerm]);

  const { selectedTermId } = useSelector((state) => state.presidency);

  const selectPresidentAndDates = (
    item,
    urlDateRange = null,
    urlSelectedDate = null
  ) => {
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


    const [rangeStart, rangeEnd] = urlDateRange || dateRange;

    const presStart = new Date(term.start);
    const presEnd = term.end
      ? new Date(term.end)
      : new Date();

    const finalStart = rangeStart
      ? new Date(Math.max(presStart, rangeStart))
      : presStart;
    const finalEnd = rangeEnd ? new Date(Math.min(presEnd, rangeEnd)) : presEnd;

    const filteredDates = gazetteDateClassic
      .filter((d) => {
        const dd = new Date(d.date);
        // Exclusive of end date if term has ended, to prevent overlap with next president's start
        return dd >= finalStart && (term.end ? dd < finalEnd : dd <= finalEnd);
      });


    dispatch(setGazetteData(filteredDates));

    let selectedDateValue;
    if (urlSelectedDate) {
      selectedDateValue = { date: urlSelectedDate };
    } else if (filteredDates.length > 0) {
      selectedDateValue = filteredDates[filteredDates.length - 1];
    } else {
      selectedDateValue = { date: finalEnd.toISOString().split("T")[0] };
    }

    dispatch(setSelectedDate(selectedDateValue));
  };



  useEffect(() => {
    if (initializedFromUrl) return;

    if (!presidentsArray || isPresidentsLoading) return;
    if (!gazetteDateClassic || gazetteDateClassic.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    let urlSelectedDate = params.get("selectedDate");
    let urlStartDate = params.get("startDate");
    let urlEndDate = params.get("endDate");

    if (urlSelectedDate) {
      // Find term covering this date
      const termToSelect = filteredPresidents.find((p) => {
        const start = new Date(p.term.start);
        const end = p.term.end ? new Date(p.term.end) : new Date();
        return new Date(urlSelectedDate) >= start && new Date(urlSelectedDate) < end;
      });

      if (termToSelect) {
        const urlRange = [new Date(urlStartDate), new Date(urlEndDate)];
        selectPresidentAndDates(termToSelect, urlRange, urlSelectedDate);
        setInitializedFromUrl(true);
        setUrlInitComplete(true);
        return;
      }
    }

    if (filteredPresidents.length > 0) {
      selectPresidentAndDates(filteredPresidents[filteredPresidents.length - 1]);
      setInitializedFromUrl(true);
    }

  }, [
    presidentsArray,
    isPresidentsLoading,
    gazetteDateClassic,
    initializedFromUrl,
    filteredPresidents
  ]);


  useEffect(() => {
    if (!initializedFromUrl) return;

    const [prevStart, prevEnd] = prevDateRangeRef.current;
    const [currStart, currEnd] = dateRange;

    // If current range is null, we can't filter yet.
    // We don't skip the first non-null range update anymore.
    if (currStart === null && currEnd === null) {
      prevDateRangeRef.current = dateRange;
      return;
    }

    if (prevStart === currStart && prevEnd === currEnd) return;

    if (urlInitComplete) {
      setUrlInitComplete(false);
      prevDateRangeRef.current = dateRange;
      return;
    }

    // Check if this date range change matches the URL we just processed
    const currentUrlSearch = location.search;
    const params = new URLSearchParams(currentUrlSearch);
    const urlStartDate = params.get("startDate");
    const urlEndDate = params.get("endDate");
    const hasFilterByName = params.get("filterByName");

    const dateRangeMatchesUrl =
      currStart && currEnd &&
      urlStartDate && urlEndDate &&
      currStart.toISOString().split("T")[0] === urlStartDate &&
      currEnd.toISOString().split("T")[0] === urlEndDate;

    // If date range doesn't match URL AND it's not a minister search navigation, 
    // this is a manual change - clear the processed URL
    if (!dateRangeMatchesUrl && !hasFilterByName) {
      lastProcessedUrlRef.current = "";
    }

    // Don't auto-select if we just processed a URL change AND the date range matches that URL
    if (lastProcessedUrlRef.current === currentUrlSearch && dateRangeMatchesUrl && currentUrlSearch.includes('selectedDate')) {
      prevDateRangeRef.current = dateRange;
      return;
    }

    if (filteredPresidents.length > 0) {
      // Check if current selection is still in the filtered list
      const isStillInList = filteredPresidents.some(p => p.termId === selectedTermId);

      if (!isStillInList) {
        // Only then auto-select the latest
        selectPresidentAndDates(filteredPresidents[filteredPresidents.length - 1]);
      }
    } else {
      selectPresidentAndDates(null);
    }

    prevDateRangeRef.current = dateRange;
  }, [dateRange, filteredPresidents, initializedFromUrl, urlInitComplete, selectedTermId]);


  useEffect(() => {
    if (!selectedDate?.date) return;
    const url = new URL(window.location.href);
    url.searchParams.set("selectedDate", selectedDate.date);
    window.history.replaceState({}, "", url.toString());
  }, [selectedDate]);

  // Monitor URL parameter changes when already on /organization route
  useEffect(() => {
    // Only run after initial URL initialization is complete
    if (!initializedFromUrl) return;

    // Don't run if we don't have the required data yet
    if (!presidentsArray || isPresidentsLoading) return;
    if (!gazetteDateClassic || gazetteDateClassic.length === 0) return;

    const currentUrlSearch = location.search;
    const params = new URLSearchParams(currentUrlSearch);
    const urlSelectedDate = params.get("selectedDate");
    const urlStartDate = params.get("startDate");
    const urlEndDate = params.get("endDate");

    // If no URL params, don't do anything
    if (!urlSelectedDate || !urlStartDate || !urlEndDate) return;

    // Check if we've already processed this exact URL
    const hasFilterByName = params.get("filterByName");
    if (lastProcessedUrlRef.current === currentUrlSearch && !hasFilterByName) return;

    // Find the term covering the selected date
    const termToSelect = filteredPresidents.find((p) => {
      const start = new Date(p.term.start);
      const end = p.term.end ? new Date(p.term.end) : new Date();
      return new Date(urlSelectedDate) >= start && new Date(urlSelectedDate) < end;
    });

    if (termToSelect) {
      const urlRange = [new Date(urlStartDate), new Date(urlEndDate)];
      selectPresidentAndDates(termToSelect, urlRange, urlSelectedDate);
      lastProcessedUrlRef.current = currentUrlSearch;
    }
  }, [location.search, location.key, initializedFromUrl, presidentsArray, isPresidentsLoading, gazetteDateClassic, filteredPresidents]);



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
            const nameText = p.name;

            const startYear = p.term.start.split("-")[0];
            const endYear = p.term.end ? new Date(p.term.end).getFullYear() : "Present";
            const term = `${startYear} - ${endYear}`;
            return (
              <button
                key={p.termId}
                onClick={() => selectPresidentAndDates(p)}
                className={`min-w-[60vw] sm:min-w-[300px] md:min-w-0 flex-shrink-0 snap-center flex items-center p-1.5 md:p-2 rounded-lg border transition-all duration-200 hover:cursor-pointer
    ${isSelected
                    ? "bg-accent/20 border-accent/35 shadow-md"
                    : "bg-foreground/5 border-primary/15 hover:bg-foreground/15"
                  }`}
              >
                <img
                  src={p.imageUrl || p.image || ""}
                  alt={nameText}
                  className="md:w-14 w-10 md:h-14 h-10 object-cover rounded-full mr-3 border border-border flex-shrink-0"
                />
                <div className="flex flex-col flex-1 text-left min-w-0">
                  <p
                    className={`font-medium text-xs md:text-sm break-words whitespace-normal ${isSelected ? "text-accent" : "text-primary"
                      }`}
                  >
                    {nameText}
                  </p>
                  <p className="text-xs md:text-sm text-primary/50 break-words whitespace-normal">
                    {term}
                  </p>
                  <div className="flex flex-nowrap gap-3 mt-1">
                    <Link
                      to={`/person-profile/${p?.id}`}
                      onClick={(e) => e.stopPropagation()}
                      state={{ mode: "back", from: location.pathname + location.search }}
                      className="text-primary/75 text-xs md:text-sm hover:text-accent transition-all animation duration-200 mt-1 flex"
                    >
                      <EyeIcon size={16} className="mr-1" />
                      <p>View Profile</p>
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
