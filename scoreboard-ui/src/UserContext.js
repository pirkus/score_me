import React, { createContext } from 'react';

export const UserContext = createContext({
  user: null,
  setUser: () => {},
}); 