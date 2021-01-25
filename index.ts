import { camelCase, first, kebabCase, mapKeys } from 'lodash'
import { Router, Method } from 'tiny-request-router'

import { fetchPageById } from 'notion-api-worker/src/api/notion'
import { getTableData } from 'notion-api-worker/src/routes/table'

type RouteParams = {
  url: URL
  params: { [k: string]: any }
}

const imgUrlPrefix =
  'https://www.notion.so/image/https:%2F%2Fs3-us-west-2.amazonaws.com%2Fsecure.notion-static.com%2F'

const cache = (caches as any).default

function notFound() {
  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
  })
}

async function getStreamerIndex(url: URL) {
  const page = await fetchPageById(INDEX_PAGE)
  const collection = first(Object.values(page.recordMap.collection))
  const collectionView = first(Object.values(page.recordMap.collection_view))
  if (!collection || !collectionView) {
    return notFound()
  }
  const { rows: origRows } = await getTableData(
    collection,
    collectionView.value.id,
  )
  const rows: Array<{ [k: string]: any }> = origRows.map((r) =>
    mapKeys(r, (v, k) =>
      k === 'CashApp' || k === 'PayPal' ? k.toLowerCase() : camelCase(k),
    ),
  )
  for (const row of rows) {
    const photoUrlStr = row.photo?.[0]?.url

    // If we quit early, omit image URLs we don't expect (to respect the origin)
    row.photo = null

    if (!photoUrlStr || !photoUrlStr.startsWith(imgUrlPrefix)) {
      continue
    }

    const photoUrl = new URL(photoUrlStr)
    const match = photoUrl.pathname.match(/%2F([\w-]+)%2F([\w-\.]+)$/)
    if (!match) {
      continue
    }
    const [_, pageId, imgName] = match

    const imgId = photoUrl.searchParams.get('id')
    if (!imgId) {
      continue
    }

    row.photo = `${url.origin}/streamers/${pageId}/${imgId}/${imgName}`

    row.slug = kebabCase(row.name.toLowerCase())

    // Work around issue with empty creators list
    if (row.creators?.length === 1 && row.creators[0] === '') {
      delete row.creators
    }
  }
  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
      'Cache-Control': `max-age=${TTL}`,
    },
  })
}

const router = new Router()

router.get('/streamers/index.json', async ({ url }: RouteParams) => {
  const cacheKey = url.toString()

  let response
  try {
    response = await cache.match(cacheKey)
  } catch (err) {}

  if (!response) {
    response = await getStreamerIndex(url)
    await cache.put(cacheKey, response.clone())
  }

  return response
})

router.get(
  '/streamers/:pageId/:imgId/:imgName',
  async ({ params: { pageId, imgId, imgName } }: RouteParams) => {
    const resp = fetch(
      `${imgUrlPrefix}${pageId}%2F${imgName}?table=block&id=${imgId}&cache=v2`,
    )
    return resp
  },
)

const handleRequest = async (fetchEvent: FetchEvent): Promise<Response> => {
  const request = fetchEvent.request
  const url = new URL(request.url)
  const { pathname } = url

  const match = router.match(request.method as Method, pathname)

  if (!match) {
    return notFound()
  }

  const res = await match.handler({
    url,
    params: match.params,
  })

  return res
}

self.addEventListener('fetch', async (event: Event) => {
  const fetchEvent = event as FetchEvent
  fetchEvent.respondWith(handleRequest(fetchEvent))
})
