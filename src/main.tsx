import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createApi } from './lib/api';
import { applyTheme, getTheme } from './lib/theme';
import './index.css';

applyTheme(getTheme());

void createApi().then((api) => {
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <App api={api} />
    </StrictMode>,
  );
});
