import { useState, useEffect } from "react";
import api from "../../../services/services";
import utils from "../../../utils/utils";
import { setAllMinistryData } from "../../../store/allMinistryData";
import { setAllDepartmentData } from "../../../store/allDepartmentData";
import presidentDetails from "../../../assets/personImages.json";
import { setAllPerson } from "../../../store/allPersonData";
import {
  setSelectedPresident,
} from "../../../store/presidencySlice";

import { useDispatch, useSelector } from "react-redux";
import { setGazetteDataClassic } from "../../../store/gazetteDate";
import PersonProfile from "../../PersonProfilePage/screens/PersonProfile";
import Error500 from "../../ErrorBoundaries/screens/500Error";
import DepartmentProfile from "../../DepartmentPage/screens/DepartmentProfile";
import SplashPage from "../components/splash_page";
import HomePage from "../../HomePage/screens/HomePage";


export default function DataLoadingAnimatedComponent({ mode }) {
  const [loading, setLoading] = useState(false);
  const [showServerError, setShowServerError] = useState(false);
  const { selectedPresident } = useSelector(
    (state) => state.presidency
  );

  const dispatch = useDispatch();


  const totalSteps = 4;
  const [completedSteps, setCompletedSteps] = useState(0);
  const [progress, setProgress] = useState(0);



  useEffect(() => {
    setProgress(Math.round((completedSteps / totalSteps) * 100));
  }, [completedSteps, totalSteps]);

  useEffect(() => {
    const initialFetchData = async () => {


      setLoading(true);
      setCompletedSteps(0);

      const track = async (promise) => {
        try {
          await promise;
        } finally {
          setCompletedSteps((prev) => prev + 1);
        }
      };

      await Promise.allSettled([
        track(fetchPersonData()),
        track(fetchAllMinistryData()),
        track(fetchAllDepartmentData()),
        track(fetchAllGazetteDate()),
      ]);

      setTimeout(() => {
        setLoading(false);
      }, 1000);
    };

    initialFetchData();
  }, []);


  const listToDict = (list) => {
    return list.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
  };

  const fetchPersonData = async () => {
    try {
      const personResponse = await api.fetchAllPersons();
      const personList = await personResponse.json();
      const personDict = listToDict(personList.body);
      dispatch(setAllPerson(personDict));

      // No need to fetch presidents here, handled by hook
    } catch (e) {
      setShowServerError(true);
      console.log(`Error fetching person data : ${e.message}`);
    }
  };

  const fetchAllDepartmentData = async () => {
    try {
      const response = await api.fetchAllDepartments();
      const departmentList = await response.json();
      const departmentDict = listToDict(departmentList.body);
      dispatch(setAllDepartmentData(departmentDict));
    } catch (e) {
      setShowServerError(true);
      console.log(`Error fetching department data : ${e.message}`);
    }
  };

  const fetchAllMinistryData = async () => {
    try {
      const [stateRes, cabinetRes] = await Promise.all([
        api.fetchAllStateMinistries(),
        api.fetchAllCabinetMinistries(),
      ]);

      const stateData = await stateRes.json();
      const cabinetData = await cabinetRes.json();

      const stateDict = listToDict(stateData.body);
      const cabinetDict = listToDict(cabinetData.body);

      const combined = {
        ...stateDict,
        ...cabinetDict,
      };

      dispatch(setAllMinistryData(combined));
    } catch (e) {
      setShowServerError(true);
      console.log(`Error fetching ministry data : ${e.message}`);
    }
  };

  const fetchAllGazetteDate = async () => {
    try {
      const response = await api.fetchInitialGazetteData();
      dispatch(setGazetteDataClassic(response));
    } catch (e) {
      setShowServerError(true);
      console.log(`Error fetching gazette dates : ${e.message}`);
    }
  };

  return (
    <>
      {loading ? (

        <SplashPage progress={progress} setProgress={setProgress} />
      ) : showServerError ? (
        <Error500 />
      ) : (
        <>
          {mode === "orgchart" ? (
            <HomePage />
          ) : mode === "person-profile" ? (
            <PersonProfile />
          ) : (
            mode === "department-profile" && <DepartmentProfile />
          )}
        </>

      )}
    </>
  );
}
