import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';
import InterceptorSetup from './components/InterceptorSetup';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DrivePage from './pages/DrivePage';
import FolderPage from './pages/FolderPage';
import SharedPage from './pages/SharedPage';
import RecycleBinPage from './pages/RecycleBinPage';
import ShareAccessPage from './pages/ShareAccessPage';

function App() {
  return (
    <>
    <InterceptorSetup />
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/share/:token" element={<ShareAccessPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DrivePage />} />
          <Route path="/folder/:id" element={<FolderPage />} />
          <Route path="/shared" element={<SharedPage />} />
          <Route path="/recycle-bin" element={<RecycleBinPage />} />
        </Route>
      </Route>
    </Routes>
    </>
  );
}

export default App;//bump
