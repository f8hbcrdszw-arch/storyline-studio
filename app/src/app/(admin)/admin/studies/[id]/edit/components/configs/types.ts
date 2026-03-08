export interface ConfigProps {
  config: Record<string, unknown>;
  onUpdate: (key: string, value: unknown) => void;
  isLocked: boolean;
}
