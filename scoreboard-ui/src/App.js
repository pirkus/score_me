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

  // Parse URL to handle direct navigation via permalinks
  useEffect(() => {
    // If we already have a scorecardId from permalink handling, we don't need to parse again
    if (selectedScorecardId && (currentView === 'view-scorecard' || currentView === 'edit-scorecard')) {
      return;
    }

    const path = window.location.pathname;
    const pathParts = path.split('/').filter(part => part !== '');
    
    if (pathParts.length >= 2) {
      const action = pathParts[0]; // "view" or "edit"
      const id = pathParts[1]; // scorecard id or encodedId
      
      if (action === 'view' && id) {
        setSelectedScorecardId(id);
        setCurrentView('view-scorecard');
      } else if (action === 'edit' && id) {
        // We'll fetch the scorecard data after user is logged in
        setSelectedScorecardId(id);
        setCurrentView('edit-scorecard-pending'); // Special state to load scorecard after login
      }
    }
  }, []);

  // Update URL when view changes
  useEffect(() => {
    if (currentView === 'view-scorecard' && selectedScorecardId) {
      // If selectedScorecardId looks like an encodedId (contains non-hex chars), use it directly
      // Otherwise try to get the scorecard data to use its encodedId
      window.history.pushState(null, '', `/view/${selectedScorecardId}`);
    } else if (currentView === 'edit-scorecard' && scorecardToEdit?.encodedId) {
      // Use encodedId for permalink URLs
      window.history.pushState(null, '', `/edit/${scorecardToEdit.encodedId}`);
    } else if (currentView === 'menu') {
      window.history.pushState(null, '', '/');
    }
  }, [currentView, selectedScorecardId, scorecardToEdit]);

  // Fetch configs when user logs in
  useEffect(() => {
    if (user && user.token) {
      fetch(`${API_URL}/scoreboard-configs`, {
        headers: { Authorization: `Bearer ${user.token}` },
      })
        .then((response) => response.json())
        .then((data) => setConfigs(data))
        .catch((error) => console.log("Error fetching configs:", error));
      
      // If we were trying to edit a scorecard via permalink, fetch it now
      if (currentView === 'edit-scorecard-pending' && selectedScorecardId) {
        fetchScorecardForEdit(selectedScorecardId);
      }
    }
  }, [user, currentView, selectedScorecardId]);

  // Try to restore user session from localStorage
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

  const fetchScorecardForEdit = async (scorecardId) => {
    if (user && user.token) {
      console.log("Fetching scorecard for edit:", scorecardId);
      try {
        // Step 1: Fetch the scorecard
        const res = await fetch(`${API_URL}/scorecards/${scorecardId}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        
        if (!res.ok) {
          console.error("Failed to fetch scorecard data for editing");
          setCurrentView('menu');
          return;
        }
        
        const data = await res.json();
        console.log("Received scorecard data:", data);
        console.log("Config name:", data.configName);
        console.log("Scores:", data.scores);
        
        // Step 2: Check if we need to fetch the config specifically
        // Only needed if this config isn't in the user's configs list
        const configExists = configs.some(c => c.name === data.configName);
        console.log("Config exists in user's configs:", configExists);
        
        if (!configExists) {
          console.log("Fetching specific config:", data.configName);
          try {
            // Fetch the config by name using the API
            const configRes = await fetch(`${API_URL}/scoreboard-configs?configName=${encodeURIComponent(data.configName)}`, {
              headers: { Authorization: `Bearer ${user.token}` },
            });
            
            if (configRes.ok) {
              const configsData = await configRes.json();
              console.log("Fetched config data:", configsData);
              
              if (configsData && configsData.length > 0) {
                // Add the config to our local state
                setConfigs(prevConfigs => [...prevConfigs, configsData[0]]);
                console.log("Added config to local state:", configsData[0]);
              } else {
                console.warn("Config not found, creating fallback from scorecard data");
                
                // Create a fallback config based on scorecard data
                const fallbackConfig = {
                  name: data.configName,
                  metrics: data.scores.map(score => ({
                    name: score.metricName,
                    expectation: "Imported from scorecard",
                    scoreType: typeof score.devScore === 'boolean' ? 'checkbox' : 'numeric'
                  }))
                };
                
                setConfigs(prevConfigs => [...prevConfigs, fallbackConfig]);
              }
            } else {
              console.error("Failed to fetch config, creating fallback");
              
              // Create a fallback config based on scorecard data
              const fallbackConfig = {
                name: data.configName,
                metrics: data.scores.map(score => ({
                  name: score.metricName,
                  expectation: "Imported from scorecard", 
                  scoreType: typeof score.devScore === 'boolean' ? 'checkbox' : 'numeric'
                }))
              };
              
              setConfigs(prevConfigs => [...prevConfigs, fallbackConfig]);
            }
          } catch (configError) {
            console.error("Error fetching specific config:", configError);
          }
        }
        
        // Step 3: Now set the scorecard to edit and change the view
        setScorecardToEdit(data);
        setCurrentView('edit-scorecard');
      } catch (error) {
        console.error("Error fetching scorecard data:", error);
        setCurrentView('menu');
      }
    }
  };

  const handleEditScorecard = async (scorecardId) => {
    await fetchScorecardForEdit(scorecardId);
  };

  return (
    <GoogleOAuthProvider clientId="96361216057-f2bbdvmomo6hqbt5sedmlgbeeud8feg7.apps.googleusercontent.com"> {/* Replace with your actual client ID */}
      <div className="App">
        <h1>🎯 Scorecard System</h1>

        {!user ? (
          <div>
            <GoogleLogin
              onSuccess={responseGoogle}
              onError={() => console.log("Login Failed")}
              theme="outline"
            />
            {(currentView === 'edit-scorecard-pending' || currentView === 'view-scorecard') && selectedScorecardId && (
              <p className="permalink-notice">Please log in to access the scorecard</p>
            )}
          </div>
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
