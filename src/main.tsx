import { createRoot } from 'react-dom/client';
import { Component, type ReactNode } from 'react';
import { App } from './App';
import { backupJSON, downloadFile } from './lib/backup';
import { getState } from './lib/store';
import './styles.css';
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="startup">
          <h1>Le carnet a rencontré une erreur.</h1>
          <p>Tu peux exporter les données déjà chargées avant de recharger.</p>
          <button
            className="button secondary"
            onClick={() =>
              downloadFile('streetlift-recuperation.json', backupJSON(getState().records))
            }
          >
            Exporter les données
          </button>
          <button className="button primary" onClick={() => location.reload()}>
            Recharger
          </button>
        </div>
      );
    return this.props.children;
  }
}
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
