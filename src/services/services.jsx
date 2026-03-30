import utils from "../utils/utils";
import axios from "@/lib/axios";

// API URLs (Using relative paths as configured)
const GI_SERVICE_URL = "/v1/organisation";
const GI_SERVICE_URL_PERSON = "/v1/person";
const apiUrl = window?.configs?.apiUrl ? window.configs.apiUrl : "";

export const getActivePortfolioList = async ({ presidentId, date, signal }) => {
  const { data } = await axios.post(
    `${GI_SERVICE_URL}/active-portfolio-list`,
    { date },
    { params: { presidentId }, signal }
  );
  return data;
};

export const getPersonProfile = async ({ personId, signal }) => {
  const { data } = await axios.get(
    `${GI_SERVICE_URL_PERSON}/person-profile/${personId}`,
    { signal }
  );
  return data;
};

export const getCabinetFlow = async ({ presidentId, dates }) => {
  const { data } = await axios.post(
    `${GI_SERVICE_URL}/cabinet-flow/${presidentId}`,
    dates
  );
  return data;
};

export const getDepartmentsByPortfolio = async ({ portfolioId, date, signal }) => {
  const { data } = await axios.post(
    `${GI_SERVICE_URL}/departments-by-portfolio/${portfolioId}`,
    { date },
    { signal }
  );
  return data;
};

export const getPrimeMinister = async ({ date, signal }) => {
  const { data } = await axios.post(
    `${GI_SERVICE_URL}/prime-minister`,
    { date },
    { signal }
  );
  return data;
};

export const getDepartmentHistory = async ({ departmentId, signal }) => {
  const { data } = await axios.get(
    `${GI_SERVICE_URL}/department-history/${departmentId}`,
    { signal }
  );
  return data;
};

export const getPersonHistory = async ({ personId, signal }) => {
  const { data } = await axios.get(
    `${GI_SERVICE_URL_PERSON}/person-history/${personId}`,
    { signal }
  );
  return data;
};

export const getAllPresidents = async ({ signal }) => {
  const { data } = await axios.get(
    `${GI_SERVICE_URL_PERSON}/all-presidents`,
    { signal }
  );

  // MOCK: Injected a multi-term president to test the TimeRangeSelector dropdown logic
  if (data && data.presidents) {
    const hasMock = data.presidents.some(p => p.id === "mock-multi-term");
    if (!hasMock) {
      data.presidents.push({
        id: "mock-multi-term",
        name: "Mock President",
        terms: [
          { start: "1993-05-07", end: "1994-08-19", gazettes_published: [] },
          { start: "2000-07-21", end: "2004-09-23", gazettes_published: [] }
        ]
      });
    }
  }

  return data;
};


// Fetch initial gazette dates from search API
const fetchInitialGazetteData = async () => {
  try {
    const payloads = [
      { major: "Document", minor: "extgztorg" },
      { major: "Document", minor: "extgztperson" }
    ];

    const results = await Promise.all(payloads.map(kind =>
      fetch(`${apiUrl}/v1/entities/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind })
      }).then(res => res.json())
    ));

    const allDates = results.flatMap(result =>
      result.body.map(item => ({
        date: item.created?.split("T")[0],
        gazetteId: [utils.extractNameFromProtobuf(item.name)]
      }))
    );

    // Merge duplicate dates and sort
    const merged = Object.values(
      allDates.reduce((acc, { date, gazetteId }) => {
        if (!acc[date]) {
          acc[date] = { date, gazetteId: [...gazetteId] };
        } else {
          acc[date].gazetteId.push(...gazetteId);
        }
        return acc;
      }, {})
    ).sort((a, b) => new Date(a.date) - new Date(b.date));

    return merged;
  } catch (error) {
    console.error("Error fetching gazette data:", error);
    return [];
  }
};

const fetchAllPersons = async () => {
  return fetch(`${apiUrl}/v1/entities/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: { major: "Person", minor: "citizen" } }),
  });
};

const fetchAllDepartments = async () => {
  return fetch(`${apiUrl}/v1/entities/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: { major: "Organisation", minor: "department" } }),
  });
};

const fetchActiveRelationsForMinistry = async (selectedDate, ministryId, relationType) => {
  return fetch(`${apiUrl}/v1/entities/${ministryId}/relations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      relatedEntityId: "",
      startTime: "",
      endTime: "",
      id: "",
      name: relationType,
      activeAt: `${selectedDate}T00:00:00Z`,
    }),
  });
};

const chatbotApiCall = async (question, session_id) => {
  try {
    console.log(`this is the question ${question}`);
    const response = await fetch(`/chat`, {
      method: "POST",
      body: JSON.stringify({ question, session_id }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const json = await response.json();
    return json;
  } catch (error) {
    console.error(`Chat Error`, error);
    return [];
  }
};

export default {
  fetchInitialGazetteData,
  fetchActiveRelationsForMinistry,
  fetchAllPersons,
  fetchAllDepartments,
  chatbotApiCall,
};
