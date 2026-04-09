import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import RegisterPage from './pages/RegisterPage';
import DrivePage from './pages/DrivePage';
import FolderPage from './pages/FolderPage';
import SharedPage from './pages/SharedPage';
import RecycleBinPage from './pages/RecycleBinPage';

function App() {
  return (
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DrivePage />} />
        <Route path="/folder/:id" element={<FolderPage />} />
        <Route path="/shared" element={<SharedPage />} />
        <Route path="/recycle-bin" element={<RecycleBinPage />} />
      </Route>
    </Routes>
  );
}

export default App;
