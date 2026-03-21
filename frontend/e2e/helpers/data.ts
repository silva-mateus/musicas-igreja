const ts = () => Date.now().toString(36)

export const testData = {
  music: {
    title: () => `E2E Musica ${ts()}`,
    artist: () => `E2E Artista ${ts()}`,
    observations: 'Musica criada por teste E2E',
  },
  list: {
    name: () => `E2E Lista ${ts()}`,
    observations: 'Lista criada por teste E2E',
  },
  category: {
    name: () => `E2E Categoria ${ts()}`,
  },
  artist: {
    name: () => `E2E Artista ${ts()}`,
  },
  customFilter: {
    groupName: () => `E2E Filtro ${ts()}`,
    valueName: () => `E2E Valor ${ts()}`,
  },
  workspace: {
    name: () => `E2E Workspace ${ts()}`,
  },
}
