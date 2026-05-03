/**
 * A basic dictionary translating Roman Urdu intent to English terms.
 * This is a lightweight representation. In a real production system, 
 * this would map directly to a trained transliteration/translation Python API.
 */
const romanUrduDict = {
  'sasta': 'cheap',
  'mehnga': 'expensive',
  'acha': 'good',
  'bura': 'bad',
  'chahiye': '',
  'mujhe': '',
  // Hardware specific mappings
  'mobile': 'smartphone',
  'joota': 'shoes',
  'kapde': 'clothes',
  'ghari': 'watch'
};

const transliterateWord = (word) => {
  const lower = word.toLowerCase();
  return romanUrduDict[lower] !== undefined ? romanUrduDict[lower] : word;
};

/**
 * Normalizes query string.
 * Strips out 'mujhe', 'chahiye', etc and translates adjectives/nouns
 */
const processQuery = (queryString, lang = 'en') => {
  // If native english, clean and return
  if(lang === 'en') {
      return queryString.trim();
  }

  // If roman urdu, translate tokens
  const words = queryString.split(/\s+/);
  const translatedWords = words.map(w => transliterateWord(w)).filter(w => w !== '');
  
  return translatedWords.join(' ').trim();
};

module.exports = {
  processQuery
};
