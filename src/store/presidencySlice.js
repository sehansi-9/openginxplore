// store/presidencySlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  selectedPresident: null,
  selectedDate: null,
  selectedTermId: null,
};

const presidencySlice = createSlice({
  name: 'presidency',
  initialState,
  reducers: {
    setSelectedPresident(state, action){
      state.selectedPresident = action.payload;
    },
    setSelectedDate(state, action) {
      state.selectedDate = action.payload;
    },
    setSelectedTermId(state, action) {
      state.selectedTermId = action.payload;
    },
  },
});

export const { setSelectedPresident, setSelectedDate, setSelectedTermId } = presidencySlice.actions;
export default presidencySlice.reducer;


