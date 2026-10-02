import { StatusBadge } from './StatusBadge';

export function Header() {
  return (
    <header className="app-header">
      <div className="app-header__title">
        <h1>Simulador de modulaciones digitales binarias</h1>
      </div>
      <StatusBadge />
    </header>
  );
}
