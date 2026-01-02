export const PAYMENT_LEXICON: Record<number, { name: string; icon: string }> = {
    0: {
      name: "None",
      icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
    },
    1: {
      name: "Credit Card",
      icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
    },
    2: {
      name: "Check",
      icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    },
    3: {
      name: "Cash",
      icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 11-4 0 2 2 0 014 0z",
    },
    4: {
      name: "Bank Transfer (Internal)",
      icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
    },
    6: {
      name: "Debit Card",
      icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
    },
    7: {
      name: "Standing Order",
      icon: "M4 4v5h.582m15356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
    },
    8: {
      name: "Electronic Payment",
      icon: "M21 12a9 9 0 11-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
    },
    9: { name: "Deposit", icon: "M19 14l-7 7m0 0l-7-7m7 7V3" },
    10: {
      name: "Fee",
      icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
    },
    11: {
      name: "Direct Debit",
      icon: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
    },
  };
  
  export const PAYMENT_OPTIONS = Object.entries(PAYMENT_LEXICON).map(([id, val]) => ({
    id: parseInt(id),
    name: val.name,
    icon: val.icon,
  }));
  
  export const INITIAL_CURRENCIES = ["EUR", "PLN", "USD", "GBP", "CHF"];
  
  export const TRANSACTION_TYPES = [
    { id: "expense", name: "Expense" },
    { id: "income", name: "Income" },
    { id: "transfer", name: "Transfer" },
  ];
  
  export const FLOW_TYPE_OPTIONS = [
    { id: "-", name: "Expense (-)" },
    { id: "+", name: "Income (+)" },
    { id: " ", name: "Internal ( )" },
  ];
  
  export const DATE_FORMATS = [
    { id: "DD-MM-YYYY", name: "DD-MM-YYYY (Europe/Default)" },
    { id: "YYYY-MM-DD", name: "YYYY-MM-DD (ISO/Database)" },
    { id: "MM-DD-YYYY", name: "MM-DD-YYYY (US)" },
  ];
