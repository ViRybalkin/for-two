export const TOP_WORLD_CUISINES = [
  "Итальянская",
  "Греческая",
  "Перуанская",
  "Португальская",
  "Испанская",
  "Японская",
  "Турецкая",
  "Китайская",
  "Французская",
  "Индонезийская",
  "Мексиканская",
  "Вьетнамская",
  "Бразильская",
  "Корейская",
  "Ливанская",
  "Русская"
] as const;

export const CUISINE_OPTIONS = [
  "Тайская",
  "Средиземноморская",
  ...TOP_WORLD_CUISINES
].filter((cuisine, index, cuisines) => cuisines.indexOf(cuisine) === index);
