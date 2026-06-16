import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { Agentation } from 'agentation';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Agentation />
    <App />
  </StrictMode>,
);
