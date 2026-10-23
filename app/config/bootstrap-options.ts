export const BOOTSTRAP_OPTIONS = Symbol('BOOTSTRAP_OPTIONS');

export type BootstrapOptions = {
  name?: string;
  homePage?: string;
  [key: string]: unknown;
};
