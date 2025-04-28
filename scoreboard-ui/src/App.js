import React from "react";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import "./App.css"; // Custom CSS for styling
import ConfigForm from "./ConfigForm"; // Import ConfigForm

// Welcome Page
const WelcomePage = () => {
  return (
    <div className="container welcome">
      <h1>👋 Welcome to score-me!</h1>
      <p>
        This is the app where you can create your own scoreboards. 
        Ready to create one?
      </p>
      <Link to="/config-form">
        <button>👉 Create a scoreboard config</button>
      </Link>
    </div>
  );
};

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/config-form" element={<ConfigForm />} />
      </Routes>
    </Router>
  );
};

export default App;
