import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './interface.css';
import './floating-shell.css';
const OsmPreview = lazy(() => import('./components/OsmPreview'));
const osmPreview = new URLSearchParams(window.location.search).get('basemap') === 'osm';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<p role="status">正在加载地图…</p>}>
      {osmPreview ? <OsmPreview /> : <App />}
    </Suspense>
  </StrictMode>,
);
