export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })
  if (!req.headers.authorization) return res.status(401).json({ error: 'Non autorisé' })

  const formData = await req.formData()
  const file = formData.get('file')
  const fld_id = formData.get('fld_id') || '0'  // dossier de destination

  if (!file) return res.status(400).json({ error: 'Fichier manquant' })

  // Étape 1 : obtenir l'URL d'upload
  const serverRes = await fetch(`https://doodapi.co/api/upload/server?key=${process.env.DOODSTREAM_API_KEY}`)
  const serverData = await serverRes.json()
  if (!serverData.result) return res.status(500).json({ error: 'Impossible d’obtenir le serveur' })
  const uploadUrl = serverData.result

  // Étape 2 : envoyer le fichier avec le bon fld_id
  const doodForm = new FormData()
  doodForm.append('api_key', process.env.DOODSTREAM_API_KEY)
  doodForm.append('file', file)
  if (fld_id !== '0') doodForm.append('fld_id', fld_id)  // important pour placer dans le dossier

  const uploadResponse = await fetch(uploadUrl, { method: 'POST', body: doodForm })
  const result = await uploadResponse.json()
  return res.status(200).json(result)
}