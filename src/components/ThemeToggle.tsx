import type { InterfaceTheme } from '../lib/use-interface-theme';
import { UiIcon } from './UiIcon';

export function ThemeToggle({
  theme,
  onChange,
}: {
  theme: InterfaceTheme;
  onChange: (theme: InterfaceTheme) => void;
}) {
  return (
    <div className="theme-toggle" role="group" aria-label="界面配色">
      <button type="button" aria-pressed={theme === 'day'} onClick={() => onChange('day')}>
        <UiIcon name="sun" size={19} />
        <span>白天</span>
      </button>
      <button type="button" aria-pressed={theme === 'night'} onClick={() => onChange('night')}>
        <UiIcon name="moon" size={19} />
        <span>夜晚</span>
      </button>
    </div>
  );
}
