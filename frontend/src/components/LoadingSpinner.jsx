import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export default function LoadingSpinner() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef(null);

  useEffect(() => {
    clearTimeout(hideTimer.current);
    setVisible(true);

    hideTimer.current = setTimeout(() => setVisible(false), 400);

    return () => clearTimeout(hideTimer.current);
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <div className="route-loader">
      <div className="route-spinner" />
    </div>
  );
}
