import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import { App } from './app/App.js';
import { applyThemeMode, storedThemeMode } from './app/theme.js';

// Applied before the first render so a saved preference never flashes the other theme.
const initialThemeMode = storedThemeMode();
applyThemeMode(initialThemeMode);

createRoot(document.getElementById('root')!).render(<App initialThemeMode={initialThemeMode} />);
