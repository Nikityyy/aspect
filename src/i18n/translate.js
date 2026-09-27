export function translate(catalog, key, fallback = '') {
  if (Object.prototype.hasOwnProperty.call(catalog, key)) return catalog[key];
  return key.split('.').reduce((value, part) => value?.[part], catalog) ?? fallback;
}
