declare module '*.css';
declare module '*.xlsx' {
  const assetId: number;
  export default assetId;
}

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
