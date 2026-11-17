import { Component, type ReactNode } from 'react';
import { ui } from './uiStore';

/** Помилка в одному екрані не повинна «білити» весь застосунок. */
export class Boundary extends Component<{ children: ReactNode; label?: string; onReset?: () => void }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { console.error('UI error in', this.props.label, err); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center bg-bg z-50">
        <div className="text-[34px]">😵</div>
        <div className="font-bold text-[18px]">Щось пішло не так</div>
        <div className="text-[13px] text-mute max-w-[300px] break-words">{this.state.err.message}</div>
        <button className="pressable h-11 px-6 rounded-2xl bg-accent text-white font-semibold" onClick={() => { this.setState({ err: null }); ui.popAll(); ui.closeAllSheets(); this.props.onReset?.(); }}>Повернутись</button>
      </div>
    );
  }
}
