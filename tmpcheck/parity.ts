import { dictionaries } from "../src/lib/i18n";
const en = Object.keys(dictionaries.en);
const missing = en.filter((k) => !dictionaries.hi[k]);
const extra = Object.keys(dictionaries.hi).filter((k) => !dictionaries.en[k]);
console.log("en", en.length, "hi", Object.keys(dictionaries.hi).length);
console.log("missing in hi:", missing);
console.log("extra in hi:", extra);
