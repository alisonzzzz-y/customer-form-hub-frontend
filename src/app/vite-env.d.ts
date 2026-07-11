// Minimal Vite env typing (the repo has no tsconfig with "vite/client" types).
interface ImportMeta {
  readonly env: {
    readonly VITE_API_BASE?: string;
  };
}
