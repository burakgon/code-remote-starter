import { useState } from 'react';
import { ToastProvider } from './lib/toast.tsx';
import { Home } from './components/Home.tsx';
import { Picker } from './components/Picker.tsx';
import { ConfirmSheet } from './components/ConfirmSheet.tsx';

export function App() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDir, setConfirmDir] = useState<string | null>(null);

  return (
    <ToastProvider>
      <Home onNew={() => setPickerOpen(true)} />
      {pickerOpen && <Picker onClose={() => setPickerOpen(false)} onChoose={setConfirmDir} />}
      {confirmDir && (
        <ConfirmSheet
          dir={confirmDir}
          onClose={() => setConfirmDir(null)}
          onLaunched={() => {
            setConfirmDir(null);
            setPickerOpen(false);
          }}
        />
      )}
    </ToastProvider>
  );
}
