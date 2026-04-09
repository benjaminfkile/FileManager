import React from 'react';
import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Routes>
      <Route path="/" element={<div>File Manager</div>} />
    </Routes>
  );
}

export default App;
