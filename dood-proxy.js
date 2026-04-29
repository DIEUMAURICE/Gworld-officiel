export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })
  if (!req.headers.authorization) return res.status(401).json({ error: 'Non autorisé' })

  const { action, ...params } = req.body
  const apiKey = process.env.DOODSTREAM_API_KEY

  try {
    let url = ''
    const searchParams = new URLSearchParams({ key: apiKey })

    switch (action) {
      case 'browse':
        // Récupère dossiers + fichiers d'un dossier
        url = 'https://doodapi.co/api/folder/list'
        searchParams.append('fld_id', params.fld_id || '0')
        searchParams.append('only_folders', '0')
        break
      case 'listFolders':
        // Liste seulement les dossiers (pour le déplacement)
        url = 'https://doodapi.co/api/folder/list'
        searchParams.append('only_folders', '1')  // seulement les dossiers
        // fld_id = 0 pour avoir tous les dossiers ? L'API a besoin d'un fld_id. On peut mettre 0 pour racine.
        searchParams.append('fld_id', '0')
        break
      case 'createFolder':
        url = 'https://doodapi.co/api/folder/create'
        searchParams.append('name', params.name)
        if (params.parent_id) searchParams.append('parent_id', params.parent_id)
        break
      case 'renameFolder':
        url = 'https://doodapi.co/api/folder/rename'
        searchParams.append('fld_id', params.fld_id)
        searchParams.append('name', params.name)
        break
      case 'renameFile':
        url = 'https://doodapi.co/api/file/rename'
        searchParams.append('file_code', params.file_code)
        searchParams.append('title', params.name)
        break
      case 'moveFile':
        url = 'https://doodapi.co/api/file/move'
        searchParams.append('file_code', params.file_code)
        searchParams.append('fld_id', params.fld_id)
        break
      case 'getFileInfo':
        url = 'https://doodapi.co/api/file/info'
        searchParams.append('file_code', params.file_code)
        break
      default:
        return res.status(400).json({ error: 'Action inconnue' })
    }

    const response = await fetch(`${url}?${searchParams.toString()}`)
    const data = await response.json()

    // Formater la sortie pour le front
    if (action === 'browse') {
      const result = data.result || {}
      return res.json({
        folders: result.folders || [],
        files: (result.files || []).map(f => ({
          file_code: f.file_code,
          title: f.title,
          canplay: f.canplay,
          views: f.views,
          length: f.length,
          download_url: f.download_url || '',
          protected_embed: f.protected_embed || '',
          protected_dl: f.protected_dl || ''
        }))
      })
    } else if (action === 'listFolders') {
      return res.json({ folders: data.result?.folders || [] })
    } else {
      return res.json(data)
    }
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' })
  }
}