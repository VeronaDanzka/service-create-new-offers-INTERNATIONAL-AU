import { REMOVE, REPLACE } from '../data/restrictedWords.js';
// ------------------------------------------------------------------
// 2. regex commune : on échappe les caractères spéciaux puis on
//    assemble toutes les expressions (les plus longues d’abord)
// ------------------------------------------------------------------
function escapeRegex(s) {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}
const union   = [...REPLACE, ...REMOVE].map(escapeRegex).join('|');
const pattern = new RegExp(`\\b(${union})\\b`, 'gi');   // insensible casse
const removeSet = new Set(REMOVE.map(w => w.toUpperCase()));

// ------------------------------------------------------------------
// 3. fonction de nettoyage
// ------------------------------------------------------------------
export function addUnderscores(text) {
  text = text.replace(pattern, (match, offset) => {
    const upper = match.toUpperCase();

    // 1) cas où on supprime le match
    if (removeSet.has(upper)) {
      return ' ';
    }

    // 2) sinon, on prépare _mot_
    const cleaned = match.replace(/ /g, '_');
    let replacement = `_${cleaned}_`;

    // 3) Vérifier dans le texte original si un '_' touche déjà la zone
    const before = text[offset - 1];
    const after  = text[offset + match.length];

    // Exemple : si before === '_' => on enlève l’underscore d’ouverture
    if (before === '_') replacement = replacement.replace(/^_/, '');

    // Idem pour after
    if (after === '_') replacement = replacement.replace(/_$/, '');

    return replacement;
  });

  // Nettoyage final
  text = text.replace(/\s{2,}/g, ' ').trim();
  return text.replace(/\s+_/g, '_').replace(/_\s+/g, '_');
}
