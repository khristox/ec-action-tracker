import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store';
import App from './App';
import './index.css';

import { setAuthFailureHandler } from './store/api/apiClient';
import { logout } from './store/slices/authSlice'; // your reducer that resets auth state

setAuthFailureHandler(() => {
  store.dispatch(logout());
  const { pathname } = window.location;
  const loginPath = `${import.meta.env.BASE_URL}login`;
  if (!pathname.startsWith(loginPath)) window.location.assign(loginPath);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);