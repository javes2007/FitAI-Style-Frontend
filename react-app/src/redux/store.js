import { configureStore } from "@reduxjs/toolkit";
import uiReducer from "./uiSlice.js";

export const store = configureStore({
  reducer: { ui: uiReducer },
  devTools: import.meta.env.DEV,
});