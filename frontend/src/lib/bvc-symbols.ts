const BVC_TV_SYMBOLS: Record<string, string> = {
  IAM: "BVC:IAM",
  ATW: "BVC:ATW",
  BOA: "BVC:BOA",
  ADH: "BVC:ADH",
  BCP: "BVC:BCP",
  CFG: "BVC:CFG",
  CMA: "BVC:CMA",
  ATL: "BVC:ATL",
};

const normalizeTicker = (ticker: string) =>
  ticker.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

export const getBvcTradingViewSymbol = (ticker: string, prefix = "BVC") => {
  if (!ticker) return `${prefix}:IAM`;
  const normalized = normalizeTicker(ticker);
  return BVC_TV_SYMBOLS[normalized] || `${prefix}:${normalized}`;
};
