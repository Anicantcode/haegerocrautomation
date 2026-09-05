import { AppProvider } from './context/AppContext.jsx';
import { HomeScreen }   from './components/HomeScreen.jsx';
import { ScannerScreen } from './components/ScannerScreen.jsx';
import { RecordsScreen } from './components/RecordsScreen.jsx';
import { useState } from 'react';

// Simple screen-based router (no react-router needed)
export default function App() {
  const [screen, setScreen] = useState('home');
  // screen: 'home' | 'scan-invoice' | 'scan-docket' | 'records'

  return (
    <AppProvider>
      <div className="max-w-lg mx-auto min-h-screen">
        {screen === 'home' && (
          <HomeScreen onNavigate={setScreen} />
        )}
        {(screen === 'scan-invoice' || screen === 'scan-docket') && (
          <ScannerScreen
            key={screen}
            mode={screen === 'scan-invoice' ? 'invoice' : 'docket'}
            onBack={() => setScreen('home')}
          />
        )}
        {screen === 'records' && (
          <RecordsScreen onBack={() => setScreen('home')} />
        )}
      </div>
    </AppProvider>
  );
}
