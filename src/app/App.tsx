import { LabProvider, useLab } from '../state/LabProvider';
import { Header } from '../ui/Header';
import { Notices } from '../ui/Notices';
import { IndicatorsGrid } from '../ui/indicators/IndicatorsGrid';
import { OriginalArea } from '../ui/lab/OriginalArea';
import { SignalsArea } from '../ui/lab/SignalsArea';
import { ModulationSelector } from '../ui/params/ModulationSelector';
import { ParamsPanel } from '../ui/params/ParamsPanel';
import { BinaryInput } from '../ui/source/BinaryInput';
import { MicPanel } from '../ui/source/MicPanel';
import { SelectionPanel } from '../ui/source/SelectionPanel';
import { SourceSelector } from '../ui/source/SourceSelector';
import { TextInput } from '../ui/source/TextInput';
function SourcePanel() {
  const { state } = useLab();
  if (state.sourceKind === 'text') return <TextInput />;
  if (state.sourceKind === 'microphone') return <MicPanel />;
  return <BinaryInput />;
}

export function App() {
  return (
    <LabProvider>
      <div className="app-shell">
        <Header />
        <div className="app-body">
          <aside className="control-panel" aria-label="Controles del experimento">
            <SourceSelector />
            <SourcePanel />
            <SelectionPanel />
            <ParamsPanel />
          </aside>
          <main className="lab" id="laboratorio">
            <ModulationSelector />
            <Notices />
            <IndicatorsGrid />
            <OriginalArea />
            <SignalsArea />
          </main>
        </div>
        <footer className="app-footer">
          <p>Versión {__APP_VERSION__}</p>
        </footer>
      </div>
    </LabProvider>
  );
}
