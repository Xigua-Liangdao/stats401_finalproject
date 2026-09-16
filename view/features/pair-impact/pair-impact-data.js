export function loadPairImpactContext(origin) {
  return {
    origin,
    selectedPlayers: origin.selectedPlayerIds ?? [],
    predicted: '—',
    actual: '—',
    score: '—',
    note: 'Shared pair-impact feature. Model output is not computed in this skeleton.',
  };
}
