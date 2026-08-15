export function StatusText({ children, assertive = false }: { children: React.ReactNode; assertive?: boolean }) {
  return <p role={assertive ? 'alert' : 'status'} aria-live={assertive ? 'assertive' : 'polite'}>{children}</p>;
}
