// Zentrale Konfiguration der Aktivitäten.
// Neue Registerkarte = neuer Eintrag.
//   type: 'check' (Haken) | 'count' (Zahl, step = Schrittweite, unit = Einheit)
//   color/c2: Farbverlauf der Kachel
//   minutes + kmPerUnit (optional): Schätzung pro Einheit. Anfänger, langsam: ca. 8 min/km,
//   also 20 min ≈ 2,5 km. Hier anpassen, wenn du schneller wirst.
export const ACTIVITIES = [
  { id: 'jog', name: 'Joggen', icon: '🏃', color: '#14b87a', c2: '#0b7f8f', type: 'check', minutes: 20, kmPerUnit: 2.5 },
  { id: 'pushup', name: 'Liegestütze', icon: '💪', color: '#ff7a33', c2: '#d8325f', type: 'count', step: 5, unit: 'Stück' },
];
