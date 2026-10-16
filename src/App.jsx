import { useState } from 'react';
import { AppProvider } from './context/AppContext.jsx';
import { ModuleSelectorScreen } from './components/ModuleSelectorScreen.jsx';
import { HomeScreen } from './components/HomeScreen.jsx';
import { ScannerScreen } from './components/ScannerScreen.jsx';
import { RecordsScreen } from './components/RecordsScreen.jsx';
import { InventoryHomeScreen } from './components/InventoryHomeScreen.jsx';
import { InventoryRecordsScreen } from './components/InventoryRecordsScreen.jsx';

export default function App() {
  const [selectedModule, setSelectedModule] = useState(() => {
    return sessionStorage.getItem('haeger_selected_module') || null;
  });
  const [screen, setScreen] = useState('home');

  const handleSelectModule = (mod) => {
    setSelectedModule(mod);
    setScreen('home');
    if (mod) {
      sessionStorage.setItem('haeger_selected_module', mod);
    } else {
      sessionStorage.removeItem('haeger_selected_module');
    }
  };

  const handleBackToModules = () => {
    handleSelectModule(null);
  };

  return (
    <AppProvider>
      <div className="max-w-lg mx-auto min-h-screen">
        {!selectedModule && (
          <ModuleSelectorScreen onSelectModule={handleSelectModule} />
        )}

        {selectedModule === 'dispatch' && (
          <>
            {screen === 'home' && (
              <HomeScreen
                onNavigate={setScreen}
                onBack={handleBackToModules}
              />
            )}
            {(screen === 'scan-invoice' || screen === 'scan-docket') && (
              <ScannerScreen
                key={`dispatch-${screen}`}
                module="dispatch"
                mode={screen === 'scan-invoice' ? 'invoice' : 'docket'}
                onBack={() => setScreen('home')}
              />
            )}
            {screen === 'records' && (
              <RecordsScreen onBack={() => setScreen('home')} />
            )}
          </>
        )}

        {selectedModule === 'inventory' && (
          <>
            {screen === 'home' && (
              <InventoryHomeScreen
                onNavigate={setScreen}
                onBack={handleBackToModules}
              />
            )}
            {(screen === 'scan-material' || screen === 'scan-bin') && (
              <ScannerScreen
                key={`inventory-${screen}`}
                module="inventory"
                mode={screen === 'scan-material' ? 'material' : 'bin'}
                onBack={() => setScreen('home')}
              />
            )}
            {screen === 'records' && (
              <InventoryRecordsScreen onBack={() => setScreen('home')} />
            )}
          </>
        )}
      </div>
    </AppProvider>
  );
}
