import React from 'react';
import { Routes, Route } from 'react-router-dom';
import RegisterPage from './pages/RegisterPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<div>File Manager</div>} />
      <Route path="/register" element={<RegisterPage />} />
    </Routes>
  );
}

export default App;
