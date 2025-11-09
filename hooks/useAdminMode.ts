import { useState, useEffect } from 'react';

/**
 * A simple hook to enable admin functionality based on a URL query parameter.
 * @returns {boolean} `true` if the URL contains `?admin=true`, otherwise `false`.
 */
export const useAdminMode = (): boolean => {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // This function checks the URL for the admin query parameter.
    const checkAdminMode = () => {
      const searchParams = new URLSearchParams(window.location.search);
      setIsAdmin(searchParams.get('admin') === 'true');
    };

    // Check immediately on component mount.
    checkAdminMode();

    // Also, listen for changes in the URL that might happen without a full page reload.
    window.addEventListener('popstate', checkAdminMode);

    // Clean up the event listener when the component unmounts.
    return () => {
      window.removeEventListener('popstate', checkAdminMode);
    };
  }, []); // The empty dependency array ensures this effect runs only once on mount.

  return isAdmin;
};