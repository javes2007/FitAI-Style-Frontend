import { createSlice } from "@reduxjs/toolkit";

const uiSlice = createSlice({
  name: "ui",
  initialState: { compactMode: false },
  reducers: {
    toggleCompactMode(state) { state.compactMode = !state.compactMode; },
    setCompactMode(state, action) { state.compactMode = Boolean(action.payload); },
  },
});

export const { toggleCompactMode, setCompactMode } = uiSlice.actions;
export default uiSlice.reducer;