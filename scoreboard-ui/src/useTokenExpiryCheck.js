import { useEffect } from "react";
import { jwtDecode } from "jwt-decode";

const useTokenExpiryCheck = (user, setUser) => {
  useEffect(() => {
    if (!user?.token) return;

    try {
      const decoded = jwtDecode(user.token);
      const currentTime = Date.now() / 1000;
      if (decoded.exp < currentTime) {
        setUser(null);
      }
    } catch (err) {
      console.warn("Invalid token:", err);
      setUser(null);
    }
  }, [user, setUser]);
};

export default useTokenExpiryCheck;
