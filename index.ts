import { AutoRouter, IRequest, cors, error } from 'itty-router'
import { getStreamerIndex, getStreamerPhoto } from './notion'

const { preflight, corsify } = cors()

const cache = caches.default

const router = AutoRouter<IRequest, [Env]>({
  before: [preflight],
  catch: (err) => {
    console.error(err)
    return error(500)
  },
})

router.get('/streamers/index.json', async ({ url }, env) => {
  const response = await getStreamerIndex(url, env)
  return corsify(response)
})

router.get(
  '/streamers/:pageId/:imgPath+',
  async ({ params: { pageId, imgPath } }, env) => {
    const cacheKey = `https://photo/${pageId}/${imgPath}`

    const cachedResponse = await cache.match(cacheKey)
    if (cachedResponse) {
      return cachedResponse
    }

    const imgURL = await getStreamerPhoto(pageId, env)
    if (!imgURL) {
      return error(404)
    }
    const response = await fetch(imgURL)
    // @ts-expect-error https://github.com/cloudflare/workerd/issues/1383
    await cache.put(cacheKey, response.clone())
    return response
  },
)

export default { ...router }
