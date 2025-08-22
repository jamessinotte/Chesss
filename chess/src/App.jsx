// src/App.jsx
import React, { Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Home from './views/Home.jsx';
import Signin from './views/Signin.jsx';
import Signup from './views/Signup.jsx';
import Chess from './chess/Chess.jsx';
import AIChess from './chess/ai/AIChess.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';

class App extends Component {
  render() {
    const token = localStorage.getItem('token');

    return (
      <Router>
        <Routes>
          {/* Default route: redirect based on token */}
          <Route path="/" element={token ? <Navigate to="/home" /> : <Navigate to="/signin" />} />

          {/* Auth Routes */}
          <Route path="/signin" element={<Signin />} />
          <Route path="/signup" element={<Signup />} />

          {/* Home Page */}
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />

          {/* Multiplayer Chess */}
          <Route
            path="/chess"
            element={
              <ProtectedRoute>
                <Chess />
              </ProtectedRoute>
            }
          />

          {/* Singleplayer AI Chess */}
          <Route
            path="/chess-ai"
            element={
              <ProtectedRoute>
                <AIChess />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    );
  }
}

export default App;
