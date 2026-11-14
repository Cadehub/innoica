import { describe, it, expect } from 'vitest';
import { cleanRawText, splitTextIntoChunks } from '../chunker.js';

describe('Text Chunker & Cleaner', () => {
  it('should clean raw text by removing consecutive newlines and normalizing spaces', () => {
    const raw = '  Texte avec    espaces multiples\r\n\r\net trois sauts\n\n\n\nde ligne.  ';
    const cleaned = cleanRawText(raw);
    expect(cleaned).toBe('Texte avec espaces multiples\n\net trois sauts\n\nde ligne.');
  });

  it('should return a single chunk if text is smaller than chunkSize', () => {
    const text = 'Ceci est un court texte de présentation.';
    const chunks = splitTextIntoChunks(text, 500, 50);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].content).toBe(text);
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it('should split larger text into multiple overlapping chunks', () => {
    const longText = `Section 1. Horaires d'ouverture de notre entreprise.
Nous sommes ouverts du lundi au vendredi de 8h00 à 18h00 sans interruption.
Le samedi, nous vous accueillons de 9h00 à 13h00. Le dimanche est fermé.

Section 2. Tarifs et prestations de service.
Nous proposons trois formules d'accompagnement : Starter, Professionnel et Entreprise.
Chaque formule inclut l'assistance et la configuration complète de votre agent.

Section 3. Contact et support technique.
Pour toute question urgente, notre support téléphonique est disponible au +237691234567.
Vous pouvez également nous écrire par email à contact@innoica.com.`;

    const chunks = splitTextIntoChunks(longText, 250, 40);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[1].chunkIndex).toBe(1);

    // Vérifier que chaque chunk a du contenu
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeGreaterThan(0);
      expect(chunk.tokenCount).toBeGreaterThan(0);
    }
  });
});
