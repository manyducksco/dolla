// Type symbols; these are used by isState, isRef, etc. functions to quickly check if a value is the expected object.
export const IS_STATE = Symbol.for("DollaState");
export const IS_REF = Symbol.for("DollaRef");
export const IS_MARKUP = Symbol.for("DollaMarkup");
export const IS_MARKUP_ELEMENT = Symbol.for("DollaMarkupElement");
// export const IS_VIEW_TEMPLATE = Symbol.for("DollaViewTemplate");
export const IS_STORE = Symbol.for("DollaStore");
export const IS_STORE_FACTORY = Symbol.for("DollaStoreFactory");

export const IS_ROUTER = Symbol.for("DollaRouter");
