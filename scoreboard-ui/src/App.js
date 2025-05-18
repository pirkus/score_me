import React, { useEffect, useState } from "react";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import ConfigForm from './ConfigForm';
import CreateOrEditScorecard from './CreateOrEditScorecard'
import ScorecardsList from './ScorecardsList'
import ViewScorecard from './ViewScorecard'
import useTokenExpiryCheck from "./useTokenExpiryCheck";
import './App.css'; // Make sure to keep your App.css for global styles

// Load environment-specific configuration
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const App = () => {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('menu');
  const [configs, setConfigs] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [selectedScorecardId, setSelectedScorecardId] = useState(null);
  const [scorecardToEdit, setScorecardToEdit] = useState(null);

  // Check for token expiration every time the user state is updated
  useTokenExpiryCheck(user, setUser);

  useEffect(() => {
    if (user && user.token) {
      fetch(`${API_URL}/scoreboard-configs`, {
        headers: { Authorization: `Bearer ${user.token}` },
      })
        .then((response) => response.json())
        .then((data) => setConfigs(data))
        .catch((error) => console.log("Error fetching configs:", error));
    }
  }, [user]);

  useEffect(() => {
    const token = localStorage.getItem("google_token");
    if (token) {
      const decoded = jwtDecode(token);
      setUser({ token, decoded });
    }
  }, []);

  const responseGoogle = (response) => {
    if (response.credential) {
      const token = response.credential;
      localStorage.setItem("google_token", token);
      const decoded = jwtDecode(token);
      setUser({ token, decoded });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("google_token");
    setUser(null);
    setCurrentView('menu');
  };

  const handleMenuSelect = (view) => {
    setCurrentView(view);
    setSelectedScorecardId(null);
    setScorecardToEdit(null);
  };

  const handleViewScorecard = (scorecardId) => {
    setSelectedScorecardId(scorecardId);
    setCurrentView('view-scorecard');
  };

  const handleEditScorecard = async (scorecardId) => {
    if (user && user.token) {
      try {
        const res = await fetch(`${API_URL}/scorecards/${scorecardId}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setScorecardToEdit(data);
          setCurrentView('edit-scorecard');
        } else {
          console.error("Failed to fetch scorecard data for editing");
        }
      } catch (error) {
        console.error("Error fetching scorecard data:", error);
      }
    }
  };

  return (
    <GoogleOAuthProvider clientId="96361216057-f2bbdvmomo6hqbt5sedmlgbeeud8feg7.apps.googleusercontent.com"> {/* Replace with your actual client ID */}
      <div className="App">
        <h1>🎯 Scorecard System</h1>

        {!user ? (
          <GoogleLogin
            onSuccess={responseGoogle}
            onError={() => console.log("Login Failed")}
            theme="outline"
          />
        ) : (
          <div>
            <p>Welcome, <strong>👋 {user.decoded.name}</strong>!</p>

            {currentView === 'menu' && (
              <div className="button-container"> {/* Use the button-container class from App.css */}
                <h2>Select an Action:</h2>
                <h3>Config</h3>
                <button onClick={() => handleMenuSelect('create-config')}>📊 Create Config</button>
                <h3>Scorecard:</h3>
                <button onClick={() => handleMenuSelect('create-scorecard')}>📝 Create Scorecard</button>
                <button onClick={() => handleMenuSelect('view-scorecards')}>📄 View Scorecards</button>
              </div>
            )}

            {currentView === 'create-config' && (
              <div className="form-container config-form">
                <ConfigForm user={user} setUser={setUser} />
              </div>
            )}

            {currentView === 'create-scorecard' && (
              <div className="form-view">
                <CreateOrEditScorecard user={user} setUser={setUser} configs={configs} />
              </div>
            )}

            {currentView === 'edit-scorecard' && (
              <div className="form-view">
                <h2>Edit Scorecard</h2>
                <CreateOrEditScorecard 
                  user={user} 
                  setUser={setUser} 
                  configs={configs} 
                  existingScorecard={scorecardToEdit}
                  onSaveSuccess={() => handleMenuSelect('view-scorecards')}
                />
              </div>
            )}

            {currentView === 'view-scorecards' && (
              <div className="form-view">
                <ScorecardsList 
                  user={user} 
                  onViewScorecard={handleViewScorecard} 
                  onEditScorecard={handleEditScorecard}
                />
              </div>
            )}

            {currentView === 'view-scorecard' && (
              <div className="form-view">
                <ViewScorecard 
                  user={user} 
                  setUser={setUser} 
                  scorecardId={selectedScorecardId} 
                />
              </div>
            )}

            <h3>Navigation</h3>
            <div className="button-container"> {/* Use the button-container class from App.css */}
              <button onClick={() => handleMenuSelect('menu')}>🔙 Back</button>
              <button onClick={handleLogout}>🚪 Logout</button>
            </div>
          </div>
        )}
      </div>
    </GoogleOAuthProvider>
  );
};

export default App;
