const natural = require('natural');
const Analyzer = natural.SentimentAnalyzer;
const stemmer = natural.PorterStemmer;

// Initialize an English sentiment analyzer using AFINN lexicon
const analyzer = new Analyzer("English", stemmer, "afinn");

/**
 * Analyzes English or Transliterated-Roman-Urdu text to return a sentiment score
 * @param {string} text 
 * @returns {Object} { score: number, label: string }
 */
const analyzeSentiment = (text) => {
  if (!text) return { score: 0, label: 'Neutral' };

  try {
      // Tokenize the string
      const tokenizer = new natural.WordTokenizer();
      const tokens = tokenizer.tokenize(text);

      // Analyze sentiment (returns a float, negative meant negative sentiment, positive meant positive)
      let score = analyzer.getSentiment(tokens);
      
      // Normalize score between roughly -1.0 to 1.0 (Afinn naturally does varying numbers)
      // Usually Afinn token scores vary from -5 to 5. The total is averaged.
      if (score > 1.0) score = 1.0;
      if (score < -1.0) score = -1.0;

      let label = 'Neutral';
      if (score > 0.2) label = 'Positive';
      else if (score < -0.2) label = 'Negative';

      return { score, label };
  } catch (err) {
      console.error('Sentiment Analysis Error:', err);
      // Fallback
      return { score: 0, label: 'Neutral' };
  }
};

module.exports = {
  analyzeSentiment
};
