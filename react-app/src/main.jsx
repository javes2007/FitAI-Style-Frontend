import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { AppProvider } from "./context/AppContext.jsx";
import { store } from "./redux/store.js";
import App from "./App.jsx";
import "./assets/styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <AppProvider>
        <App />
      </AppProvider>
    </Provider>
  </React.StrictMode>
);