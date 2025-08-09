export interface Env {
  DOG_IMAGES: R2Bucket
}

interface DogInfo {
  name: string
  gender: string
  breed: string
  age: number
  imageUrl?: string
}

const sessions = new Map<string, DogInfo>()

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === '/api/quiz/start' && req.method === 'POST') {
      const info = (await req.json()) as Partial<DogInfo>
      if (!info.name || !info.gender || !info.breed || typeof info.age !== 'number') {
        return jsonResponse({ error: 'Missing dog details' }, 400)
      }
      const id = crypto.randomUUID()
      sessions.set(id, info as DogInfo)
      return jsonResponse({ id })
    }

    if (url.pathname === '/api/quiz/image' && req.method === 'POST') {
      const { id } = Object.fromEntries(url.searchParams)
      if (!id || !sessions.has(id)) {
        return jsonResponse({ error: 'Invalid session' }, 400)
      }
      const info = sessions.get(id) as DogInfo
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      let imageData: ArrayBuffer
      let filename: string

      if (file) {
        imageData = await file.arrayBuffer()
        filename = `${id}-upload`
      } else {
        const text = `Image of ${info.breed} ${info.gender} named ${info.name}`
        imageData = new TextEncoder().encode(text).buffer
        filename = `${id}-generated.txt`
      }

      await env.DOG_IMAGES.put(filename, imageData)
      const urlBase = 'https://pub-54eaf3ceb23642c1b8e28724cd75f23e.r2.dev/'
      info.imageUrl = urlBase + filename
      sessions.set(id, info)
      return jsonResponse({ imageUrl: info.imageUrl })
    }

    return new Response('Not found', { status: 404 })
  },
}
