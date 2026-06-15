/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import CryptoDashboard from './components/CryptoDashboard';
import { ToastProvider } from './components/Toast';
import { ExchangeProvider } from './contexts/ExchangeContext';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <ExchangeProvider>
        <ToastProvider>
          <div className="min-h-screen bg-background">
            <CryptoDashboard />
          </div>
        </ToastProvider>
      </ExchangeProvider>
    </ErrorBoundary>
  );
}
