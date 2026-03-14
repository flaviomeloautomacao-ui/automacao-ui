import { Sidebar } from "./Sidebar";
import css from "./AppShell.module.css";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className={css.shell}>
      <Sidebar />
      <div className={css.content}>
        <main className={css.main}>{children}</main>
      </div>
    </div>
  );
}
