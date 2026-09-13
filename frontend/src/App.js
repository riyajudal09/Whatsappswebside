import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import Login from './pages/user-login/Login';
import Home from './pages/home/Home';
import { checkUserAuth } from './api/authApi';
import useUserStore from './store/useUserStore';

function Protected({ children }) {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const setUser = useUserStore((s) => s.setUser);
  const clearUser = useUserStore((s) => s.clearUser);

  useEffect(() => {
    let active = true;
    checkUserAuth().then((result) => {
      if (!active) return;
      if (result.isAuthenticated) {
        setUser(result.user);
        setAllowed(true);
      } else {
        clearUser();
        setAllowed(false);
      }
    }).finally(() => active && setChecking(false));
    return () => { active = false; };
  }, [setUser, clearUser]);

  if (checking) return <div className="app-loader"><div className="spinner" />Loading WhatsApp...</div>;
  return allowed ? children : <Navigate to="/user-login" replace />;
}

export default function App() {
  return (
    <>
      <ToastContainer position="top-right" theme="colored" />
      <Routes>
        <Route path="/" element={<Protected><Home /></Protected>} />
        <Route path="/user-login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
