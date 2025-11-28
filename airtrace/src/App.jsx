import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';

// Import the REAL pages now
import Signup from './app/login/Signup.jsx';
import Login from './app/login/Login.jsx';
import MapPage from './app/map/MapPage.jsx';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Default to Login if no path provided */}
          <Route path="/" element={<Navigate to="/login" />} />
          
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          
          {/* The Main App */}
          <Route path="/map" element={<MapPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;